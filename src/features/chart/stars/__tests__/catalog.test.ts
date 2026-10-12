import { filterCatalog, parseCatalog } from '../catalog';
const entry={name:'Arcturus',designation:'alBoo',display_designation:'α Boo',constellation:'Bootes',magnitude:-.05,longitude:204.2,sign:'Libra',degrees:24,minutes:12};
test('catalog keeps metadata separate from saved identity and searches every supported label',()=>{
  const stars=parseCatalog(JSON.stringify([entry,{...entry,name:'Regulus',longitude:150,magnitude:1.36,constellation:'Leo'}]));
  expect(stars[0]).toMatchObject({id:'star:arcturus',displayDesignation:'α Boo'});
  for(const query of [' arc ','alBoo','α Boo','boot']) expect(filterCatalog(stars,query,'name').some(star=>star.name==='Arcturus')).toBe(true);
  expect(filterCatalog(stars,'','position')[0].name).toBe('Regulus');
  expect(filterCatalog(stars,'','magnitude')[0].name).toBe('Arcturus');
});
test.each([{...entry,longitude:360},{...entry,minutes:60},{...entry,name:''},{...entry,magnitude:null}])('rejects malformed native catalog entries',value=>expect(()=>parseCatalog(JSON.stringify([value]))).toThrow());
test('rejects duplicate catalog identities',()=>expect(()=>parseCatalog(JSON.stringify([entry,{...entry,name:'arcturus'}]))).toThrow());
