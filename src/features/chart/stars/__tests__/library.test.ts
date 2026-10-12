import { StarLibraryRepository, parseStarLibrary } from '../library';
function storage() {
  const values = new Map<string,string>();
  return {values,getItem:jest.fn(async(key:string) => values.get(key) ?? null),setItem:jest.fn(async(key:string,value:string) => { values.set(key,value); })};
}
test('one library survives remounts and stores references without metadata or calculated positions',async()=>{
  const disk=storage(), repo=new StarLibraryRepository(disk,'did:plc:alice');
  expect(()=>repo.add('Arcturus')).toThrow('Restore');
  await repo.load(); await repo.add('Arcturus'); await repo.add('arcturus');
  expect(repo.state.stars).toEqual([{id:'star:arcturus',name:'Arcturus'}]);
  const restored=new StarLibraryRepository(disk,'did:plc:alice'); await restored.load();
  expect(restored.state.stars).toEqual(repo.state.stars);
  const other=new StarLibraryRepository(disk,'did:plc:bob'); await other.load();
  const anonymous=new StarLibraryRepository(disk,null); await anonymous.load();
  expect(other.state.stars).toEqual([]); expect(anonymous.state.stars).toEqual([]);
  await restored.remove('star:arcturus'); expect(restored.state.stars).toEqual([]);
});
test('failed or corrupt reads never overwrite stored stars; retry and explicit reset recover',async()=>{
  const disk=storage(), repo=new StarLibraryRepository(disk,null);
  disk.values.set(repo.key,'corrupt'); await repo.load();
  expect(repo.state.loadError).toBe(true); expect(()=>repo.add('Regulus')).toThrow(); expect(disk.setItem).not.toHaveBeenCalled();
  disk.values.set(repo.key,JSON.stringify({version:1,stars:[{id:'star:regulus',name:'Regulus'}]}));
  await repo.load(); expect(repo.state.stars[0].name).toBe('Regulus');
  await repo.reset(); expect(repo.state.stars).toEqual([]);
});
test('rapid writes serialize and a failed write retains current edits for retry',async()=>{
  const disk=storage(), repo=new StarLibraryRepository(disk,null); await repo.load();
  let release!:()=>void;
  disk.setItem.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;})).mockRejectedValueOnce(new Error('disk'));
  const first=repo.add('Regulus'); const second=repo.add('Arcturus');
  await Promise.resolve(); expect(disk.setItem).toHaveBeenCalledTimes(1);
  release(); await first; await second; expect(repo.state.saveError).toBe(true); expect(repo.state.stars).toHaveLength(2);
  await repo.retrySave(); expect(repo.state.saveError).toBe(false);
  expect(parseStarLibrary(disk.values.get(repo.key)!)).toEqual(repo.state.stars);
});
test.each([
  {version:2,stars:[]}, {version:1,stars:[{id:'star:wrong',name:'Regulus'}]},
  {version:1,stars:[{id:'star:regulus',name:'Regulus'},{id:'star:regulus',name:'regulus'}]},
])('rejects malformed identity/version',value=>expect(()=>parseStarLibrary(JSON.stringify(value))).toThrow());
