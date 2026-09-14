import ExpoModulesCore
import CryptoKit

public class KairosModule: Module {
    // Process lifetime: fast refresh must not reinitialize the Rust globals.
    private static let engineQueue = DispatchQueue(label: "studio.zojer.kairos.engine")
    private static var initialized = false

    public func definition() -> ModuleDefinition {
        Name("Kairos")
        AsyncFunction("calculateChart") { (request: String) -> String in
            try Self.initializeIfNeeded()
            return try Self.unwrap(request.withCString { kairos_calculate_chart($0) })
        }.runOnQueue(Self.engineQueue)
        AsyncFunction("searchLocations") { (query: String) -> String in
            try Self.initializeIfNeeded()
            return try Self.unwrap(query.withCString { kairos_search_locations($0, 30) })
        }.runOnQueue(Self.engineQueue)
    }

    private static func initializeIfNeeded() throws {
        guard !initialized else { return }
        let moduleBundle = Bundle(for: KairosModule.self)
        guard let url = moduleBundle.url(forResource: "KairosEphemeris", withExtension: "bundle")
                ?? Bundle.main.url(forResource: "KairosEphemeris", withExtension: "bundle"),
              let bundle = Bundle(url: url),
              let manifestURL = bundle.url(forResource: "manifest", withExtension: "json"),
              let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: manifestURL)) as? [String: String]
        else { throw KairosException("Bundled ephemeris is missing. Rebuild the app.") }
        for (name, expected) in manifest {
            let data = try Data(contentsOf: url.appendingPathComponent(name))
            let actual = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            guard actual == expected else { throw KairosException("Ephemeris checksum failed: \(name)") }
        }
        guard let atlasURL = bundle.url(forResource: "atlas", withExtension: "db")
        else { throw KairosException("Bundled atlas is missing. Rebuild the app.") }
        _ = try unwrap(url.path.withCString { path in
            "sqlite://\(atlasURL.path)?mode=ro".withCString { atlas in kairos_init(atlas, path) }
        })
        initialized = true
    }

    private static func unwrap(_ result: KairosResult) throws -> String {
        defer { kairos_result_free(result) }
        guard result.success, let data = result.data else {
            throw KairosException(result.error.map { String(cString: $0) } ?? "Unknown engine error")
        }
        return String(cString: data)
    }
}

final class KairosException: GenericException<String> {
    override var reason: String { param }
}
