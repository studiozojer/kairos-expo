import { getAllStarPositions } from '../../../../../modules/kairos';
import { loadStarCatalog } from '../catalog';
jest.mock('../../../../../modules/kairos',()=>({getAllStarPositions:jest.fn()}));
const native=jest.mocked(getAllStarPositions);
test('missing native bridge is recoverable; concurrent callers share work and successful catalog is cached',async()=>{
  native.mockImplementationOnce(()=>{throw new Error('Older native build');});
  await expect(loadStarCatalog()).rejects.toThrow('Older native build');
  native.mockResolvedValueOnce('[]'); await expect(loadStarCatalog()).rejects.toThrow('empty');
  const raw=JSON.stringify([{name:'Arcturus',designation:'alBoo',display_designation:'α Boo',constellation:'Bootes',magnitude:-.05,longitude:204.2,sign:'Libra',degrees:24,minutes:12}]);
  native.mockResolvedValueOnce(raw);
  const first=loadStarCatalog(), second=loadStarCatalog(); expect(first).toBe(second);
  const stars=await first; expect(stars[0].name).toBe('Arcturus');
  expect(await loadStarCatalog()).toBe(stars); expect(native).toHaveBeenCalledTimes(3);
});
