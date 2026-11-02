'use strict';
const $=id=>document.getElementById(id), KEY='cpf_v2';
const defaults=['トレカプラザ55 大須アメ横店','カードラボ 名古屋大須店','ホビーステーション 名古屋大須本店','イエローサブマリン 名古屋GAME SHOP','GIRAFULL 名古屋大須店'];
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now()+Math.random();
let data=load(),editId=null,cardImage=null,cardFile=null,ocrBusy=false,scans=[];
function load(){try{let d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.cards)&&Array.isArray(d.prices)){d.shops=Array.isArray(d.shops)?d.shops:[];d.sold=Array.isArray(d.sold)?d.sold:[];d.shopMemos=Array.isArray(d.shopMemos)?d.shopMemos:[];d.customOnlineShops=Array.isArray(d.customOnlineShops)?d.customOnlineShops:[];return d}}catch(e){}return {cards:[],prices:[],shops:defaults.map((name,i)=>({id:'s'+i,name})),sold:[],shopMemos:[],customOnlineShops:[]}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));render();return true}catch(e){alert('保存できませんでした。画像容量やSafariの保存領域をご確認ください。バックアップを推奨します。');return false}}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(Number(n||0)).toLocaleString('ja-JP');
const median=a=>{if(!a.length)return null;let s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const getCard=id=>data.cards.find(c=>c.id===id);
function tab(id){document.querySelectorAll('.view').forEach(e=>e.classList.toggle('hidden',e.id!==id));document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('active',e.dataset.tab===id));}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function options(id,old){let e=$(id);e.innerHTML=data.cards.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} ${esc(c.rarity||'')}</option>`).join('');if(old&&data.cards.some(c=>c.id===old))e.value=old}
function render(){const sels=['mercariTarget','compareTarget','priceTarget','marketTarget','overallTarget','memoCard'];sels.forEach(id=>options(id,$(id).value));$('cardList').innerHTML=data.cards.length?data.cards.map(c=>`<div class="item"><div class="cardrow">${c.image?`<img class="thumb" src="${c.image}" alt="カード画像">`:'<div class="thumb"></div>'}<div style="min-width:0;flex:1"><div class="name">${esc(c.name)}</div><div class="muted">${esc(c.cardNo||'番号未登録')} / ${esc(c.rarity||'レアリティ未登録')}</div><div class="chip">必要 ${Number(c.wanted)||1} 枚</div> <span class="chip">${esc(c.priority||'中')}</span><div class="muted">${esc(c.version||'')}</div></div></div><div class="actions"><button class="secondary" data-edit="${esc(c.id)}">編集</button><button class="secondary" data-sold="${esc(c.id)}">相場を見る</button><button class="danger" data-del="${esc(c.id)}">削除</button></div></div>`).join(''):'<p class="muted">まだカードがありません。</p>';
$('cardList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editCard(b.dataset.edit));$('cardList').querySelectorAll('[data-sold]').forEach(b=>b.onclick=()=>{openMarket(b.dataset.sold)});$('cardList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('カードと紐づく価格・売却データを削除しますか？')){data.cards=data.cards.filter(c=>c.id!==b.dataset.del);data.prices=data.prices.filter(p=>p.cardId!==b.dataset.del);data.sold=data.sold.filter(p=>p.cardId!==b.dataset.del);data.shopMemos=data.shopMemos.filter(p=>p.cardId!==b.dataset.del);persist()}});
renderSold();renderLinks();renderPrices();renderShopComparison();renderMarketOverview();renderShops();renderShopMemos();renderOverall();}
function resetCard(){editId=null;cardImage=null;cardFile=null;$('formTitle').textContent='カードを登録';['cardName','cardNo','rarity','version'].forEach(x=>$(x).value='');$('wanted').value=1;$('priority').value='中';$('cardFile').value='';$('detailFile').value='';$('detailDebug').classList.add('hidden');$('detailStatus').textContent='';detailBitmap=null;$('detailCropBox').classList.add('hidden');$('cropPanel').classList.add('hidden');$('cancelEdit').classList.add('hidden');$('cardOcrStatus').textContent='';}
function editCard(id){let c=getCard(id);if(!c)return;editId=id;cardImage=c.image||null;cardFile=null;$('formTitle').textContent='カードを編集';['name','cardNo','rarity','version','wanted','priority'].forEach(k=>$(k==='name'?'cardName':k).value=c[k]??(k==='wanted'?1:''));$('cardFile').value='';$('detailFile').value='';$('detailDebug').classList.add('hidden');$('detailStatus').textContent='';detailBitmap=null;$('detailCropBox').classList.add('hidden');$('cropPanel').classList.toggle('hidden',!c.image);$('cardPreview').src=c.image||'';$('cancelEdit').classList.remove('hidden');tab('wishlist');window.scrollTo(0,0)}
$('cancelEdit').onclick=resetCard;
$('saveCard').onclick=async()=>{let name=$('cardName').value.trim();if(!name)return alert('カード名を入力してください');let wanted=Number($('wanted').value);if(!Number.isInteger(wanted)||wanted<1||wanted>999)return alert('必要枚数を1〜999で入力してください');let c=editId?getCard(editId):{id:uid(),created:Date.now()};if(!c)return;Object.assign(c,{name,cardNo:$('cardNo').value.trim(),rarity:$('rarity').value.trim(),version:$('version').value.trim(),wanted,priority:$('priority').value,game:'ヴァンガード',image:cardImage||null});if(!editId)data.cards.push(c);if(persist())resetCard()};
$('cardFile').onchange=async e=>{cardFile=e.target.files[0];if(!cardFile)return;try{cardImage=await cropImage(cardFile);$('cardPreview').src=cardImage;$('cropPanel').classList.remove('hidden');$('cardOcrStatus').textContent='白背景を自動除去しました。カード全体が写っているか確認してください。';}catch(err){$('cardOcrStatus').textContent='画像を読み込めませんでした: '+err.message}};
async function loadImage(source){let img=new Image(),url=typeof source==='string'?source:URL.createObjectURL(source);try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});return img}finally{if(typeof source!=='string')URL.revokeObjectURL(url)}}
function findCardBounds(img){const max=650,ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height;const ink=(xx,yy)=>{let i=(yy*w+xx)*4;return d[i+3]>100&&Math.min(d[i],d[i+1],d[i+2])<225};const cols=[],rows=[];for(let xx=0;xx<w;xx++){let n=0;for(let yy=0;yy<h;yy+=2)if(ink(xx,yy))n++;cols.push(n)}for(let yy=0;yy<h;yy++){let n=0;for(let xx=0;xx<w;xx+=2)if(ink(xx,yy))n++;rows.push(n)}const segments=(arr,threshold)=>{let found=[],start=-1;for(let i=0;i<=arr.length;i++){if(i<arr.length&&arr[i]>=threshold){if(start<0)start=i}else if(start>=0){if(i-start>=Math.max(5,Math.round(arr.length*.045)))found.push([start,i]);start=-1}}return found};let xs=segments(cols,Math.max(3,Math.round(h*.10))),ys=segments(rows,Math.max(3,Math.round(w*.10)));let best=null;for(let [l,r] of xs)for(let [t,b] of ys){let cw=r-l,ch=b-t,aspect=cw/ch;if(aspect<.57||aspect>.83||cw<w*.18||ch<h*.24)continue;let score=cw*ch;if(!best||score>best.score)best={l,r,t,b,score}};if(!best){let minX=w,minY=h,maxX=0,maxY=0;for(let yy=0;yy<h;yy+=2)for(let xx=0;xx<w;xx+=2)if(ink(xx,yy)){minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy)}if(maxX-minX<w*.12||maxY-minY<h*.12)return {sx:0,sy:0,sw:img.naturalWidth,sh:img.naturalHeight};best={l:minX,r:maxX+1,t:minY,b:maxY+1}}let pad=Math.max(2,Math.round(Math.min(best.r-best.l,best.b-best.t)*.012));return {sx:Math.max(0,best.l-pad)/ratio,sy:Math.max(0,best.t-pad)/ratio,sw:Math.min(w,best.r+pad)/ratio-Math.max(0,best.l-pad)/ratio,sh:Math.min(h,best.b+pad)/ratio-Math.max(0,best.t-pad)/ratio}}
async function cropImage(source){let img=await loadImage(source),b=findCardBounds(img),scale=Math.min(1,850/Math.max(b.sw,b.sh)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.sw*scale));c.height=Math.max(1,Math.round(b.sh*scale));c.getContext('2d').drawImage(img,b.sx,b.sy,b.sw,b.sh,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.84)}
$('cropCheck').onclick=async()=>{if(!cardFile)return;try{cardImage=await cropImage(cardFile);$('cardPreview').src=cardImage;$('cardOcrStatus').textContent='白背景を自動除去しました。'}catch(e){alert(e.message)}};

const shopNames=[['カードラッシュ','https://www.google.com/search?q=site%3Acardrush-vanguard.jp+'],['カードラボ','https://www.google.com/search?q=site%3Ac-labo-online.jp+'],['遊々亭','https://www.google.com/search?q=site%3Ayuyu-tei.jp+'],['ドラゴンスター','https://www.google.com/search?q=site%3Adorasuta.jp%2Fvanguard%2F+'],['通販のPAO','https://www.google.com/search?q=site%3Apao-onlineshop.com+']];
function renderLinks(){
  const c=getCard($('compareTarget').value);
  // カード番号を名称やレアリティから推測せず、登録値から直接使用する。
  const cardNo=String(c?.cardNo||'').normalize('NFKC').replace(/[\s　]+/g,'').replace(/[／]/g,'/');
  const term=cardNo||String(c?.name||'').trim();
  const mk=(name,url)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>`;
  $('shopLinks').innerHTML=shopNames.map(([n,p])=>mk(n,p+encodeURIComponent(term))).join('');
  const query='ヴァンガード '+term;
  $('marketLinks').innerHTML=mk('楽天市場','https://search.rakuten.co.jp/search/mall/?sitem='+encodeURIComponent(query))+
    mk('Amazon','https://www.amazon.co.jp/s?k='+encodeURIComponent(query));
}
$('compareTarget').onchange=()=>selectMarketCard($('compareTarget').value);
$('mercariSearch').onclick=()=>{let c=getCard($('mercariTarget').value);if(!c)return alert('カードを登録してください');window.open('https://jp.mercari.com/search?keyword='+encodeURIComponent('ヴァンガード '+c.name)+'&status=sold_out','_blank','noopener')};
// メルカリは参考価格のメモだけを保存します。画像OCR・自動相場集計は行いません。
$('manualAdd').onclick=()=>{const id=$('mercariTarget').value,p=Number($('manualPrice').value);if(!id)return alert('カードを選択してください');if(!Number.isFinite(p)||p<=0)return alert('価格を入力してください');data.sold.push({id:uid(),cardId:id,price:p,title:$('manualTitle').value.trim(),source:'手動メモ',created:Date.now()});if(persist()){$('manualPrice').value='';$('manualTitle').value=''}};
function renderSold(){const id=$('mercariTarget').value,rows=data.sold.filter(x=>x.cardId===id);$('mercariSummary').innerHTML=`<div class="panel"><h2>メルカリ参考メモ</h2><p class="muted">${rows.length}件の手動メモがあります。売却相場の自動算出は行いません。</p></div>`;$('mercariRecords').innerHTML=rows.slice().reverse().map(e=>`<div class="item"><div class="row"><b>${yen(e.price)}</b><span class="muted">${new Date(e.created||Date.now()).toLocaleDateString('ja-JP')}</span></div><p class="muted">${esc(e.title||'メモなし')}</p><div class="actions"><button class="secondary" data-soldedit="${esc(e.id)}">修正</button><button class="danger" data-solddelete="${esc(e.id)}">削除</button></div></div>`).join('');$('mercariRecords').querySelectorAll('[data-soldedit]').forEach(b=>b.onclick=()=>{let e=data.sold.find(x=>x.id===b.dataset.soldedit);let p=prompt('参考価格（円）',e.price);if(p===null)return;let n=Number(p);if(!Number.isFinite(n)||n<=0)return alert('正しい価格を入力してください');let t=prompt('メモ',e.title||'');if(t===null)return;e.price=n;e.title=t;persist()});$('mercariRecords').querySelectorAll('[data-solddelete]').forEach(b=>b.onclick=()=>{if(confirm('このメモを削除しますか？')){data.sold=data.sold.filter(x=>x.id!==b.dataset.solddelete);persist()}})};
$('mercariTarget').onchange=()=>selectMarketCard($('mercariTarget').value);
$('savePrice').onclick=()=>{let id=$('priceTarget').value,p=Number($('price').value);if(!id||!Number.isFinite(p)||p<0||$('price').value==='')return alert('カードと価格を入力してください');data.prices.push({id:uid(),cardId:id,kind:$('kind').value,source:$('sourceName').value.trim(),price:p,shipping:Number($('shipping').value)||0,stock:$('stock').value,condition:$('condition').value,note:$('itemNote').value,url:$('url').value,created:Date.now()});if(persist())$('price').value=''};
function renderPrices(){let id=$('compareTarget').value,rows=data.prices.filter(x=>x.cardId===id),online=rows.filter(x=>x.kind==='online'),best=online.filter(x=>x.stock!=='売り切れ').sort((a,b)=>(Number(a.price)+Number(a.shipping))-(Number(b.price)+Number(b.shipping)))[0];$('priceSummary').innerHTML=`<div class="panel"><h2>登録済み通販価格</h2><div class="price">${best?yen(Number(best.price)+Number(best.shipping)):'データなし'}</div><p class="muted">手動登録の送料込み参考最安値。在庫数・必要枚数は未照合です。</p></div>`;$('priceRecords').innerHTML=rows.slice().reverse().map(p=>`<div class="item"><div class="row"><b>${esc(p.source||'名称なし')}</b><b class="gold">${yen(Number(p.price)+Number(p.shipping))}</b></div><p class="muted">${p.origin==='feed'?'連携データ':'手動登録'} / ${esc(p.kind)} / 在庫: ${esc(p.stock||'不明')} / ${esc(p.note||'')} ${p.origin==='feed'?' / 確認日時: '+esc(p.checkedAt||'不明'):''}</p><div class="actions">${/^https?:\/\//.test(p.url||'')?`<a class="btn secondary" href="${esc(p.url)}" target="_blank" rel="noopener">商品ページ</a>`:''}<button class="danger" data-price-del="${esc(p.id)}">削除</button></div></div>`).join('');$('priceRecords').querySelectorAll('[data-price-del]').forEach(b=>b.onclick=()=>{if(confirm('価格情報を削除しますか？')){data.prices=data.prices.filter(p=>p.id!==b.dataset.priceDel);persist()}})};
function renderShops(){$('shopSettings').innerHTML=data.shops.map(s=>`<div class="row item"><span>${esc(s.name)}</span><button class="danger" data-shop-del="${esc(s.id)}">削除</button></div>`).join('');$('shopSettings').querySelectorAll('[data-shop-del]').forEach(b=>b.onclick=()=>{data.shops=data.shops.filter(s=>s.id!==b.dataset.shopDel);persist()})}
$('addShop').onclick=()=>{let n=$('newShop').value.trim();if(n){data.shops.push({id:uid(),name:n});$('newShop').value='';persist()}};
$('export').onclick=()=>{let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cpf-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let d=JSON.parse(await f.text());if(!Array.isArray(d.cards)||!Array.isArray(d.prices))throw Error('バックアップ形式が違います');if(!confirm('現在のデータをバックアップの内容で置き換えますか？'))return;d.shops=Array.isArray(d.shops)?d.shops:[];d.sold=Array.isArray(d.sold)?d.sold:[];d.shopMemos=Array.isArray(d.shopMemos)?d.shopMemos:[];d.customOnlineShops=Array.isArray(d.customOnlineShops)?d.customOnlineShops:[];let prev=data;data=d;if(!persist())data=prev;else resetCard()}catch(err){alert('読み込みに失敗: '+err.message)}finally{e.target.value=''}};
render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});


// Detail screenshot preview is drawn directly to canvas after the file is decoded.
// This avoids blob URL image-preview races in iOS standalone PWAs.
let detailBitmap=null,detailBounds={x:0,y:0,w:1,h:1},detailDrag=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function detailSelectionRender(){
 const canvas=$('detailCropImage'),sel=$('detailCropSelection');
 Object.assign(sel.style,{left:(detailBounds.x*100)+'%',top:(detailBounds.y*100)+'%',width:(detailBounds.w*100)+'%',height:(detailBounds.h*100)+'%'});
 $('detailCropInfo').textContent='選択範囲：横 '+Math.round(detailBounds.w*100)+'%・縦 '+Math.round(detailBounds.h*100)+'%。枠の内側で移動、四隅で大きさを変更できます。';
}
function detailReset(){detailBounds={x:0,y:0,w:1,h:1};detailSelectionRender()}
$('detailCropReset').onclick=detailReset;
$('detailFile').addEventListener('change',async()=>{
 detailBitmap=null;$('detailCropBox').classList.add('hidden');$('detailCropError').textContent='';
 const file=$('detailFile').files[0];if(!file)return;
 ocrStatus('詳細画像を読み込み中…');
 try{
  const im=await loadImage(file);
  if(!im.naturalWidth||!im.naturalHeight)throw Error('画像のサイズを取得できません');
  detailBitmap=im;
  const canvas=$('detailCropImage');
  const scale=Math.min(1,900/im.naturalWidth);
  canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像プレビューを作成できません');
  ctx.drawImage(im,0,0,canvas.width,canvas.height);
  detailBounds={x:.05,y:.12,w:.90,h:.76};
  $('detailCropBox').classList.remove('hidden');
  requestAnimationFrame(detailSelectionRender);
  ocrStatus('詳細画像のプレビューを表示しました。指で範囲を指定できます。');
 }catch(e){detailBitmap=null;$('detailCropBox').classList.remove('hidden');$('detailCropError').textContent='画像プレビューの読み込みに失敗：'+e.message;ocrStatus('画像の読み込みに失敗しました。別の画像を選択してください。')}
});
const cropStage=$('detailCropStage');
const MIN_CROP=.08;
// Use native touch events on iOS Safari/PWA, with mouse fallback on desktop.
// Dragging is attached to window so fingers leaving the selection don't cancel movement.
function cropPoint(x,y){const r=$('detailCropImage').getBoundingClientRect();return {x:clamp((x-r.left)/Math.max(1,r.width),0,1),y:clamp((y-r.top)/Math.max(1,r.height),0,1)}}
function cropHit(p){const b=detailBounds;const r=$('detailCropImage').getBoundingClientRect();const mx=Math.min(.12,28/Math.max(1,r.width)),my=Math.min(.12,28/Math.max(1,r.height));for(const [mode,x,y] of [['nw',b.x,b.y],['ne',b.x+b.w,b.y],['sw',b.x,b.y+b.h],['se',b.x+b.w,b.y+b.h]]){if(Math.abs(p.x-x)<=mx&&Math.abs(p.y-y)<=my)return mode}return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h?'move':null}
function beginCrop(x,y,kind,id){if(!detailBitmap||detailDrag)return false;const p=cropPoint(x,y),mode=cropHit(p);if(!mode)return false;detailDrag={kind,id,mode,start:p,original:{...detailBounds}};return true}
function moveCrop(x,y){if(!detailDrag)return;const p=cropPoint(x,y),d=detailDrag,b=d.original,dx=p.x-d.start.x,dy=p.y-d.start.y;let left=b.x,top=b.y,right=b.x+b.w,bottom=b.y+b.h;if(d.mode==='move'){left=clamp(b.x+dx,0,1-b.w);top=clamp(b.y+dy,0,1-b.h);right=left+b.w;bottom=top+b.h}else{if(d.mode.includes('w'))left=clamp(b.x+dx,0,right-MIN_CROP);if(d.mode.includes('e'))right=clamp(b.x+b.w+dx,left+MIN_CROP,1);if(d.mode.includes('n'))top=clamp(b.y+dy,0,bottom-MIN_CROP);if(d.mode.includes('s'))bottom=clamp(b.y+b.h+dy,top+MIN_CROP,1)}detailBounds={x:left,y:top,w:right-left,h:bottom-top};detailSelectionRender()}
function stopCrop(){if(!detailDrag)return;detailDrag=null;detailSelectionRender()}
cropStage.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.changedTouches[0];if(beginCrop(t.clientX,t.clientY,'touch',t.identifier))e.preventDefault()},{passive:false});
window.addEventListener('touchmove',e=>{if(!detailDrag||detailDrag.kind!=='touch')return;const t=Array.from(e.changedTouches).find(t=>t.identifier===detailDrag.id);if(!t)return;e.preventDefault();moveCrop(t.clientX,t.clientY)},{passive:false});
window.addEventListener('touchend',e=>{if(detailDrag&&detailDrag.kind==='touch'&&Array.from(e.changedTouches).some(t=>t.identifier===detailDrag.id))stopCrop()},{passive:false});
window.addEventListener('touchcancel',e=>{if(detailDrag&&detailDrag.kind==='touch')stopCrop()},{passive:false});
cropStage.addEventListener('mousedown',e=>{if(e.button!==0)return;if(beginCrop(e.clientX,e.clientY,'mouse',0))e.preventDefault()});
window.addEventListener('mousemove',e=>{if(detailDrag&&detailDrag.kind==='mouse'){e.preventDefault();moveCrop(e.clientX,e.clientY)}});
window.addEventListener('mouseup',()=>{if(detailDrag&&detailDrag.kind==='mouse')stopCrop()});
function detailOcrCanvas(){
 if(!detailBitmap)throw Error('詳細画像を選択してください');
 const b=detailBounds,im=detailBitmap;
 const sx=Math.round(b.x*im.naturalWidth),sy=Math.round(b.y*im.naturalHeight),sw=Math.max(1,Math.round(b.w*im.naturalWidth)),sh=Math.max(1,Math.round(b.h*im.naturalHeight));
 const scale=Math.min(2.5,Math.max(1,1700/sw));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(im,sx,sy,sw,sh,0,0,canvas.width,canvas.height);return canvas;
}
function normalizeHeading(raw){
 let s=raw.replace(/[\u200b-\u200d]/g,'').replace(/[　\s]+/g,'').replace(/[（(][^）)]{1,35}[）)]/g,'');
 s=s.replace(/[A-Za-z][A-Za-z0-9]{0,5}$/,'').replace(/^[^ぁ-んァ-ヶ一-龠]+|[^ぁ-んァ-ヶ一-龠ー・]+$/g,'');
 return s;
}
function plausibleHeading(t){return t.length>=2&&t.length<=35&&/[ぁ-んァ-ヶ一-龠]/.test(t)&&!/(?:その他|ペルソナ|グレード|パワー|シールド|クリティカル|スタンダード|進化|スキル|カード|質問|検索|ヴァンガード|あなた|ターン中|ショップ|ログイン)/.test(t)}
function findHeadingNameV17(ocr){
 const raw=(ocr.text||'').split(/\n/).map(t=>t.trim()).filter(Boolean);
 const anchor=raw.findIndex(t=>/その他|ペルソナシリーズ|ペルソナトークン/.test(t.replace(/\s/g,'')));
 if(anchor>=0){for(let i=anchor-1;i>=Math.max(0,anchor-3);i--){const candidate=normalizeHeading(raw[i]);if(plausibleHeading(candidate))return candidate}}
 const lines=(ocr.lines||[]).map(l=>({name:normalizeHeading(l.text||''),confidence:l.confidence||0,y:l.bbox?.y0||0}));
 const attrs=lines.filter(l=>/その他|ペルソナ/.test(l.name));
 if(attrs.length){const y=Math.min(...attrs.map(l=>l.y));const before=lines.filter(l=>l.y<y&&plausibleHeading(l.name)&&l.confidence>=35).sort((a,b)=>b.y-a.y);if(before.length)return before[0].name}
 // When the screenshot has been tightly cropped, the heading may be the first valid Japanese line.
 if(detailBounds.w<.9||detailBounds.h<.9){const candidates=raw.map(normalizeHeading).filter(plausibleHeading);if(candidates.length)return candidates[0]}
 return '';
}
// OCR is performed locally in the browser. Japanese language data may download on first use.
let ocrWorker=null;
function ocrStatus(message){$('detailStatus').textContent=message;}
async function recognize(source){
 if(!window.Tesseract)throw Error('OCRライブラリが読み込めません。オンラインで再度開いてください');
 if(!ocrWorker){
  ocrStatus('OCRの準備中：日本語・英語の認識データを読み込んでいます…（初回は時間がかかります）');
  ocrWorker=await Tesseract.createWorker('jpn+eng',1,{logger:m=>{
   if(m.status==='recognizing text')ocrStatus('文字を認識中… '+Math.round((m.progress||0)*100)+'%');
   else if(m.status==='loading language traineddata')ocrStatus('日本語認識データを読み込み中… '+Math.round((m.progress||0)*100)+'%');
  }});
 }
 ocrStatus('画像の文字を解析しています…');
 const result=await ocrWorker.recognize(source);
 return result.data;
}
// 固定座標を使わず、公式ページの項目ラベルとOCR文字列の並びで抽出します。
function extractDetail(fullText){
 const lines=fullText.split(/\n/).map(t=>t.replace(/[｜|]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 const ignore=/^(?:カードリスト|カード詳細|カード検索|検索|MENU|メニュー|HOME|ホーム|ログイン|カードファイト|ヴァンガード|公式サイト|戻る|前へ|次へ|画像|カード画像|カード名|カード情報|スタンダード|デッキ|商品情報|レギュレーション|レアリティ|カード番号)$/i;
 const codePattern=/(?:DZ|D|V|G|BT|PR|P|TD|EB|CP|T)[-－][A-Z0-9+\-]{2,18}\s*\/\s*[A-Z0-9+\-]{1,15}/i;
 const codeNormalize=t=>t.toUpperCase().replace(/[‐‑–—−－]/g,'-').replace(/\s*\/\s*/g,'/');
 const normalized=lines.map(codeNormalize);
 let code='',rarity='';
 // 「スタンダード」の直後にあるカード番号と、その右のレアリティを優先する。
 let standardIndex=lines.findIndex(t=>/スタンダード/.test(t));
 let candidates=[];
 if(standardIndex>=0)candidates=[...normalized.slice(standardIndex,standardIndex+4)];
 candidates.push(...normalized);
 for(const line of candidates){let m=line.match(codePattern);if(m){code=m[0].replace(/\s/g,'');const right=line.slice(m.index+m[0].length);let r=right.match(/(?:^|\s|[:：])\s*(T\+|RRRR|RRR|RR|R|C|FFR|FR|SR|SEC|SP|PR|ORR|DSR|EXRR|EX)(?=\s|$|[）)])/i);if(r)rarity=r[1].toUpperCase();break}}
 if(!rarity&&code){const idx=normalized.findIndex(l=>l.includes(code));const after=idx>=0?normalized.slice(idx+1,idx+3).join(' '):'';const m=after.match(/^(?:レアリティ\s*[:：]?\s*)?(T\+|RRRR|RRR|RR|R|C|FFR|FR|SR|SEC|SP|PR|ORR|DSR|EXRR|EX)(?=\s|$)/i);if(m)rarity=m[1].toUpperCase()}
 // OCRテキストの先頭はiPhoneの時刻・URLになりやすい。名前は後述の見出し判定で決める。
 let name='';
 return {name,cardNo:code,rarity};
}
// カード名はOCR行の位置関係から「公式サイトの見出し」を探す。
// 画面内の固定ピクセル座標ではなく、スタンダード行・サイトの上部・文字サイズを手掛かりにする。
function findHeadingName(ocr){
 // OCRの先頭行にはiOS時刻やブラウザ操作が含まれるため採用しない。
 // 公式詳細ページのカード名は「その他｜ペルソナシリーズ…」の属性行の直前。
 const raw=(ocr.text||'').split(/\n/).map(t=>t.replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim()).filter(Boolean);
 const reject=t=>/\d{1,2}:\d{2}|(?:github|vanguard)\.(?:io|com)|https?:|www\.|[<>@]|質問|検索|ヴァンガード|カードファイト|スタンダード|その他|ペルソナ|グレード|パワー|シールド|クリティカル|©|SEGA|AT LUS|前のカード|次のカード|検索結果|カードリスト|メニュー|MENU|ホーム|HOME|カード名|進化[:：]|【|\+5000/.test(t)||!/[ぁ-んァ-ヶ一-龠]/.test(t)||t.length<2||t.length>35;
 const clean=t=>t.replace(/^[\s|｜・:：]+|[\s|｜・:：]+$/g,'').replace(/\s*[（(][^）)]{1,40}[）)]\s*$/,'').trim();
 const anchor=raw.findIndex(t=>/その他|ペルソナシリーズ|ペルソナトークン/.test(t));
 if(anchor>=0){
  // 属性行のすぐ前を優先し、離れたブラウザUI文字は拾わない。
  for(let i=anchor-1;i>=Math.max(0,anchor-4);i--){const t=clean(raw[i]);if(!reject(t))return t;}
 }
 // 座標付きOCR行があれば、属性行の直上にある見出しを選ぶ。
 const lines=(ocr.lines||[]).map(l=>({text:clean(l.text||''),box:l.bbox||{},confidence:l.confidence||0}));
 const attrs=lines.filter(l=>/その他|ペルソナシリーズ|ペルソナトークン/.test(l.text)&&Number.isFinite(l.box.y0));
 if(attrs.length){const y=Math.min(...attrs.map(l=>l.box.y0));const candidates=lines.filter(l=>!reject(l.text)&&Number.isFinite(l.box.y1)&&l.box.y1<y&&y-l.box.y1<y*.24&&l.confidence>=30).sort((a,b)=>b.box.y1-a.box.y1);if(candidates.length)return candidates[0].text;}
 return '';
}
$('scanDetail').onclick=async()=>{
 const file=$('detailFile').files[0];if(!file)return alert('公式サイトの詳細画面スクリーンショットを選択してください');
 const btn=$('scanDetail');btn.disabled=true;btn.textContent='読み取り中…';ocrStatus('読み取りを開始しています…');
 try{
  const ocr=await recognize(detailOcrCanvas());
  const fullText=ocr.text||'';
  if(!fullText.trim())throw Error('OCRで文字を検出できませんでした。画像の鮮明さを確認してください');
  ocrStatus('認識文字からカード情報を抽出中…');
  const parsed=extractDetail(fullText);
  parsed.name=findHeadingNameV17(ocr);
  if(parsed.name)$('cardName').value=parsed.name;
  else $('detailStatus').textContent='カード名の見出しを確実に特定できませんでした。手入力してください。';
  if(parsed.cardNo)$('cardNo').value=parsed.cardNo;
  if(parsed.rarity)$('rarity').value=parsed.rarity;
  $('detailText').textContent='【カード名抽出方法：見出し候補・空白除去】\n【読み取り全文】\n'+fullText+'\n\n【見出し候補（OCR行）】\n'+(ocr.lines||[]).filter(l=>/[ぁ-んァ-ヶ一-龠]/.test(l.text||'')).slice(0,30).map(l=>`${l.text} / y=${l.bbox?.y0||0} / confidence=${Math.round(l.confidence||0)}`).join('\n');
  $('detailDebug').classList.remove('hidden');
  $('detailStatus').textContent=`候補：名前 ${parsed.name||'未検出'} / 番号 ${parsed.cardNo||'未検出'} / レアリティ ${parsed.rarity||'未検出'}。必ず確認・修正してください。`;
 }catch(e){$('detailStatus').textContent='読み取り失敗：'+e.message+'。手入力で登録できます。'}finally{btn.disabled=false;btn.textContent='詳細画面から名前・番号・レアリティを読み取る'}
};


// v2.0: 端末内の手動登録データだけを使った比較。外部サイトを自動取得しない。
function comparisonSearchUrl(name,card){
  // Always open a Google results page. Do not depend on outdated shop domains or guessed product URLs.
  const no=String(card?.cardNo||'').normalize('NFKC').replace(/[\s　]+/g,'').replace(/／/g,'/');
  const cardName=String(card?.name||'').trim();
  const rarity=String(card?.rarity||'').trim();
  const words=['ヴァンガード',name,no||cardName];
  if(no&&cardName)words.push(cardName);
  if(rarity)words.push(rarity);
  return 'https://www.google.com/search?q='+encodeURIComponent(words.filter(Boolean).join(' '));
}
function renderShopComparison(){
  const target=$('shopCompareTable');
  if(!target)return;
  const cardId=$('compareTarget').value;
  const card=getCard(cardId);
  if(!cardId){target.innerHTML='<p class="muted">カードを登録してください。</p>';return;}
  const names=[...shopNames.map(s=>s[0]),...(data.customOnlineShops||[]).map(s=>s.name)];
  const records=data.prices.filter(p=>p.cardId===cardId&&p.kind==='online');
  const normalize=s=>String(s||'').replace(/[\s　]/g,'').toLowerCase();
  const rows=names.map(name=>{
    const matching=records.filter(p=>normalize(p.source)===normalize(name));
    const recent=matching.slice().sort((a,b)=>(b.created||0)-(a.created||0))[0];
    return {name,p:recent};
  });
  const known=rows.filter(r=>r.p&&r.p.stock!=='売り切れ'&&Number.isFinite(Number(r.p.price))&&r.p.price!==''&&Number.isFinite(Number(r.p.shipping))&&r.p.shipping!=='');
  const min=known.length?Math.min(...known.map(r=>Number(r.p.price)+Number(r.p.shipping))):null;
  target.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>店舗</th><th>価格</th><th>送料</th><th>合計</th><th>在庫</th><th>操作</th></tr></thead><tbody>'+
    rows.map(({name,p})=>{
      const valid=p&&p.price!==''&&p.shipping!==''&&Number.isFinite(Number(p.price))&&Number.isFinite(Number(p.shipping));
      const total=valid?Number(p.price)+Number(p.shipping):null;
      const best=valid&&p.stock!=='売り切れ'&&min!==null&&total===min;
      return '<tr style="border-top:1px solid #55462c"><td>'+esc(name)+(best?' <b class="quick-best">最安</b>':'')+((data.customOnlineShops||[]).find(x=>x.name===name)?.url?'<br><a target="_blank" rel="noopener noreferrer" href="'+esc(data.customOnlineShops.find(x=>x.name===name).url)+'">サイトを開く</a>':'')+'</td><td>'+(valid?yen(p.price):'未確認')+'</td><td>'+(valid?yen(p.shipping):'—')+'</td><td>'+(valid?'<span class="quick-total">'+yen(total)+'</span>':'—')+'</td><td>'+esc(p?.stock||'未確認')+'</td><td><a class="quick-search" href="'+esc(comparisonSearchUrl(name,card))+'" target="_blank" rel="noopener noreferrer">検索 ↗</a><button class="secondary" data-quick-shop="'+esc(name)+'">入力</button>'+(p?'<button class="danger" data-quick-delete="'+esc(p.id)+'">価格削除</button>':'')+((data.customOnlineShops||[]).some(x=>x.name===name)?'<button class="danger" data-custom-remove="'+esc(name)+'">サイト削除</button>':'')+'</td></tr>';
    }).join('')+'</tbody></table></div><p class="muted">最安表示は登録済みデータのみが対象です。送料未確認・在庫なしは最安判定から除外してください。</p>';
  target.querySelectorAll('[data-custom-remove]').forEach(btn=>btn.onclick=()=>{
    const name=btn.dataset.customRemove;
    if(!confirm('「'+name+'」を比較表から削除しますか？登録済みの価格記録は残ります。'))return;
    data.customOnlineShops=data.customOnlineShops.filter(x=>x.name!==name);
    persist();
  });
  target.querySelectorAll('[data-quick-delete]').forEach(btn=>btn.onclick=()=>{if(confirm('この店舗の価格・送料記録を削除しますか？')){data.prices=data.prices.filter(p=>p.id!==btn.dataset.quickDelete);persist();}});
  target.querySelectorAll('[data-quick-shop]').forEach(btn=>btn.onclick=()=>{
    const name=btn.dataset.quickShop;
    $('priceTarget').value=cardId;
    $('kind').value='online';
    $('sourceName').value=name;
    const p=rows.find(r=>r.name===name)?.p;
    $('price').value=p?.price??'';
    $('shipping').value=p?.shipping??'';
    $('stock').value=p?.stock||'不明';
    $('condition').value=p?.condition||'未確認';
    $('itemNote').value=p?.note||'';
    $('url').value=p?.url||'';
    $('price').scrollIntoView({behavior:'smooth',block:'center'});
    $('price').focus();
  });
}

// v2.1: one unified market view for each saved card, retaining cpf_v2 data.
function selectMarketCard(id){
  if(!getCard(id))return;
  ['marketTarget','compareTarget','mercariTarget','priceTarget'].forEach(key=>{if($(key))$(key).value=id});
  renderLinks();renderPrices();renderShopComparison();renderSold();renderMarketOverview();
}
function openMarket(id){
  selectMarketCard(id);tab('compare');
  window.scrollTo({top:0,behavior:'auto'});
}
function renderMarketOverview(){
  const target=$('marketOverview');if(!target)return;
  const id=$('marketTarget').value,c=getCard(id);
  if(!c){target.innerHTML='<p class="muted">登録済みカードがありません。</p>';return;}
  const records=data.prices.filter(p=>p.cardId===id&&p.kind==='online'&&p.stock!=='売り切れ'&&p.price!==''&&p.shipping!==''&&Number.isFinite(Number(p.price))&&Number.isFinite(Number(p.shipping)));
  const best=records.length?Math.min(...records.map(p=>Number(p.price)+Number(p.shipping))):null;
  const memo=data.sold.filter(p=>p.cardId===id).slice().sort((a,b)=>(b.created||0)-(a.created||0));
  target.innerHTML='<div class="market-card">'+(c.image?'<img class="thumb" alt="カード画像" src="'+esc(c.image)+'">':'')+'<div><b>'+esc(c.name)+'</b><div class="muted">'+esc(c.cardNo||'番号未登録')+' / '+esc(c.rarity||'レアリティ未登録')+'</div></div></div>'+
    '<div class="market-stats"><div class="market-stat"><small>通販最安値（送料込み）</small><strong>'+(best===null?'未登録':yen(best))+'</strong></div><div class="market-stat"><small>メルカリ参考価格（最新メモ）</small><strong>'+(memo.length?yen(memo[0].price):'未登録')+'</strong></div></div>';
}
$('marketTarget').onchange=()=>selectMarketCard($('marketTarget').value);


// v2.4 shop notes and cross-channel comparison (local data only).
const memoDateInput=$('memoDate');
memoDateInput.value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
function renderShopMemos(){
  const buttons=$('memoShopButtons'),logs=$('memoLogs');
  buttons.innerHTML=data.shops.map(x=>'<button type="button" class="secondary" data-memo-shop="'+esc(x.id)+'">'+esc(x.name)+'</button>').join('');
  buttons.querySelectorAll('[data-memo-shop]').forEach(b=>b.onclick=()=>{
    const shop=data.shops.find(x=>x.id===b.dataset.memoShop);if(shop)$('memoShopName').value=shop.name;
  });
  logs.innerHTML=(data.shopMemos||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(b.created||0)-(a.created||0)).map(m=>{
    const c=getCard(m.cardId);
    return '<div class="item"><div class="row"><b>'+esc(m.shop)+'</b><span class="muted">'+esc(m.date||'日付不明')+'</span></div><div>'+esc(c?.name||'削除されたカード')+' / <b class="gold">'+yen(m.price)+'</b></div><p class="muted">'+esc(m.note||'')+'</p><div class="actions"><button class="danger" data-memo-del="'+esc(m.id)+'">削除</button></div></div>';
  }).join('')||'<p class="muted">まだ店舗価格メモはありません。</p>';
  logs.querySelectorAll('[data-memo-del]').forEach(b=>b.onclick=()=>{
    if(confirm('この店舗価格メモを削除しますか？')){data.shopMemos=data.shopMemos.filter(m=>m.id!==b.dataset.memoDel);persist();}
  });
}
$('memoSave').onclick=()=>{
  const cardId=$('memoCard').value,shop=$('memoShopName').value.trim(),raw=$('memoPrice').value;
  const price=Number(raw),date=$('memoDate').value;
  if(!cardId||!shop||raw===''||!Number.isFinite(price)||price<0||!date)return alert('カード・店舗・価格・日付を入力してください');
  data.shopMemos.push({id:uid(),cardId,shop,price,date,note:$('memoNote').value.trim(),created:Date.now()});
  if(persist()){$('memoPrice').value='';$('memoNote').value='';}
};
$('overallTarget').onchange=renderOverall;
function renderOverall(){
  const target=$('overallResults'),id=$('overallTarget').value;
  if(!id){target.innerHTML='<p class="muted">カードを登録してください。</p>';return;}
  const prices=data.prices.filter(p=>p.cardId===id&&p.stock!=='売り切れ'&&p.price!==''&&Number.isFinite(Number(p.price))&&Number(p.price)>=0);
  const online=prices.filter(p=>p.kind==='online'&&p.shipping!==''&&Number.isFinite(Number(p.shipping))&&Number(p.shipping)>=0).map(p=>({label:p.source||'通販（名称未入力）',value:Number(p.price)+Number(p.shipping),type:'通販'}));
  const store=prices.filter(p=>p.kind==='store').map(p=>({label:p.source||'店頭（名称未入力）',value:Number(p.price),type:'店頭'}));
  // Shop log is a dated observation. Only latest observation per shop is compared.
  const latest=new Map();
  (data.shopMemos||[]).filter(m=>m.cardId===id&&Number.isFinite(Number(m.price))&&Number(m.price)>=0).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(b.created||0)-(a.created||0)).forEach(m=>{if(!latest.has(m.shop))latest.set(m.shop,m)});
  const logStore=[...latest.values()].map(m=>({label:m.shop+'（'+m.date+'）',value:Number(m.price),type:'店頭'}));
  // Avoid counting duplicate shop entries from the price form and the shop log.
  const shopKeys=new Set(logStore.map(x=>x.label.replace(/（.*$/,'')));
  const storeAll=[...store.filter(x=>!shopKeys.has(x.label)),...logStore];
  const mercari=(data.sold||[]).filter(p=>p.cardId===id&&Number.isFinite(Number(p.price))&&Number(p.price)>0).map(p=>({label:'メルカリ参考メモ',value:Number(p.price),type:'メルカリ'}));
  const groups=[['通販',online],['メルカリ',mercari],['店頭',storeAll]];
  const values=groups.map(([name,arr])=>({name,arr,median:median(arr.map(x=>x.value))}));
  const typical=median(values.filter(x=>x.median!==null).map(x=>x.median));
  const all=groups.flatMap(([,arr])=>arr).sort((a,b)=>a.value-b.value);
  const cheapest=all[0];
  target.innerHTML='<div class="market-stats"><div class="market-stat"><small>3種総合の参考相場（中央値）</small><strong>'+(typical===null?'未登録':yen(typical))+'</strong></div><div class="market-stat"><small>登録情報での最安値</small><strong>'+(cheapest?yen(cheapest.value):'未登録')+'</strong></div></div>'+
    (cheapest?'<p class="notice">最安：'+esc(cheapest.type)+' / '+esc(cheapest.label)+' / '+yen(cheapest.value)+'</p>':'')+
    '<div style="overflow-x:auto"><table style="width:100%;font-size:13px"><thead><tr><th>種類</th><th>登録数</th><th>中央値</th><th>最安値</th></tr></thead><tbody>'+
    values.map(x=>'<tr><td>'+x.name+'</td><td>'+x.arr.length+'</td><td>'+(x.median===null?'未登録':yen(x.median))+'</td><td>'+(x.arr.length?yen(Math.min(...x.arr.map(y=>y.value))):'未登録')+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="muted">※登録した参考価格を比較したもので、リアルタイムの在庫や販売価格を保証しません。店頭ログは店舗ごとの最新記録を使用します。</p>';
}

// v2.5: manual custom online shops, independent of the existing in-store shop buttons.
$('toggleCustomOnline').onclick=()=>{$('customOnlineForm').classList.toggle('hidden');};
$('cancelCustomOnline').onclick=()=>{$('customOnlineForm').classList.add('hidden');};
$('saveCustomOnline').onclick=()=>{
  const name=$('customOnlineName').value.trim(),rawUrl=$('customOnlineUrl').value.trim();
  if(!name)return alert('通販サイト名を入力してください');
  if([...shopNames.map(x=>x[0]),...data.customOnlineShops.map(x=>x.name)].some(x=>x.replace(/\s/g,'').toLowerCase()===name.replace(/\s/g,'').toLowerCase()))return alert('同じ名前の通販サイトは登録済みです');
  let url='';
  if(rawUrl){try{const u=new URL(rawUrl);if(!['https:','http:'].includes(u.protocol))throw Error();url=u.href;}catch(e){return alert('URLはhttps://またはhttp://から入力してください');}}
  data.customOnlineShops.push({id:uid(),name,url});
  if(persist()){$('customOnlineName').value='';$('customOnlineUrl').value='';$('customOnlineForm').classList.add('hidden');}
};

// v2.6 TEST: same-origin feed ingestion only. No scraping or invented store prices.
$('fetchAutoFeed').onclick=async()=>{
 const status=$('autoFeedStatus'),button=$('fetchAutoFeed');button.disabled=true;status.textContent='価格データを確認しています…';
 try{
  const response=await fetch('./prices-feed.json?ts='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('価格データを読み込めませんでした (HTTP '+response.status+')');
  const feed=await response.json();
  if(!feed||feed.schema!==1||!Array.isArray(feed.items))throw Error('データ形式が不正です');
  if(feed.items.length>1000)throw Error('データ件数が上限を超えています');
  let added=0,skipped=0,updated=0;
  for(const item of feed.items){
   const norm=v=>String(v||'').trim().replace(/[\s　]/g,'').toUpperCase();
   const card=data.cards.find(c=>norm(c.cardNo)&&norm(c.rarity)&&norm(c.cardNo)===norm(item.cardNo)&&norm(c.rarity)===norm(item.rarity));
   const price=Number(item.price),shipping=Number(item.shipping);
   const checked=Date.parse(item.checkedAt||'');
   const valid=card&&typeof item.source==='string'&&item.source.trim().length>0&&item.source.length<=100&&Number.isSafeInteger(price)&&price>0&&Number.isSafeInteger(shipping)&&shipping>=0&&['あり','残りわずか','売り切れ'].includes(item.stock)&&Number.isFinite(checked)&&checked<=Date.now()+300000&&checked>=Date.now()-7*86400000;
   let url='';if(item.url){try{const u=new URL(item.url);if(!['http:','https:'].includes(u.protocol))throw Error();url=u.href}catch(e){skipped++;continue}}
   if(!valid){skipped++;continue}
   const source=item.source.trim(),existing=data.prices.find(p=>p.origin==='feed'&&p.cardId===card.id&&p.source===source);
   if(existing&&Date.parse(existing.checkedAt||'')>=checked){skipped++;continue}
   const entry={cardId:card.id,kind:'online',source,price,shipping,stock:item.stock,condition:'未確認',note:'自動連携データ（商品情報を購入前に確認）',url,origin:'feed',checkedAt:new Date(checked).toISOString(),created:Date.now()};
   if(existing){Object.assign(existing,entry);updated++}else{data.prices.push({id:uid(),...entry});added++}
  }
  if(added||updated)persist();
  status.textContent=`連携データ：${feed.items.length}件 / 新規${added}件 / 更新${updated}件 / 対象外・未変更${skipped}件。${feed.items.length===0?'現在、連携価格データはありません。':''}`;
 }catch(e){status.textContent='取得失敗：'+e.message+'。既存の価格データは変更していません。'}
 finally{button.disabled=false}
};
