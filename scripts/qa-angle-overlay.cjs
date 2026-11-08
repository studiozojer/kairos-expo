const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');const fs=require('fs');
(async()=>{const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
const dir=process.env.KAIROS_EVIDENCE || '/tmp/kairos-angle-evidence';fs.mkdirSync(dir,{recursive:true});
for(const [name,width,height] of [['desktop',1440,1100],['mobile',390,844]]){
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:Number(process.env.KAIROS_DPR || 1)});
await page.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-11-08T20:00:00Z']));}static now(){return new NativeDate('2026-11-08T20:00:00Z').getTime();}}});
if(process.env.KAIROS_STRESS) await page.route('**/local/calculate', async route => {
  const response = await route.fetch(); const chart = await response.json();
  const longitudes = {2001: 287, 2002: 289, 2003: 107, 2004: 109};
  for(const node of chart.celestial.nodes) if(longitudes[node.body_id] !== undefined) {
    node.position.longitude=longitudes[node.body_id]; node.sign_placement=node.position.longitude>180?'Capricorn':'Cancer';
  }
  await route.fulfill({response,json:chart});
});
await page.goto(process.env.KAIROS_URL || 'http://127.0.0.1:8765');await page.locator('canvas').waitFor();
if(await page.locator('[role=alert]').count()) throw Error('Chart failed');await page.waitForTimeout(1000);
for(const mode of ['glyphs','inner','zodiac','outside']){await page.getByLabel('Angles',{exact:true}).selectOption(mode);await page.waitForTimeout(500);await page.locator('.workspace').screenshot({path:`${dir}/${name}-${mode}.png`});}
await page.close();}await browser.close()})();
