'use strict';
const $=id=>document.getElementById(id), KEY='cpf_v2';
const defaults=['トレカプラザ55 大須アメ横店','カードラボ 名古屋大須店','ホビーステーション 名古屋大須本店','イエローサブマリン 名古屋GAME SHOP','GIRAFULL 名古屋大須店'];
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now()+Math.random();
let data=load(),editId=null,cardImage=null,cardFile=null,ocrBusy=false,scans=[];
function load(){try{let d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.cards)&&Array.isArray(d.prices)){d.shops=Array.isArray(d.shops)?d.shops:[];d.sold=Array.isArray(d.sold)?d.sold:[];return d}}catch(e){}return {cards:[],prices:[],shops:defaults.map((name,i)=>({id:'s'+i,name})),sold:[]}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));render();return true}catch(e){alert('保存できませんでした。画像容量やSafariの保存領域をご確認ください。バックアップを推奨します。');return false}}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(Number(n||0)).toLocaleString('ja-JP');
const median=a=>{if(!a.length)return null;let s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const getCard=id=>data.cards.find(c=>c.id===id);
function tab(id){document.querySelectorAll('.view').forEach(e=>e.classList.toggle('hidden',e.id!==id));document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('active',e.dataset.tab===id));}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function options(id,old){let e=$(id);e.innerHTML=data.cards.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} ${esc(c.rarity||'')}</option>`).join('');if(old&&data.cards.some(c=>c.id===old))e.value=old}
function render(){const sels=['mercariTarget','compareTarget','priceTarget'];sels.forEach(id=>options(id,$(id).value));$('cardList').innerHTML=data.cards.length?data.cards.map(c=>`<div class="item"><div class="cardrow">${c.image?`<img class="thumb" src="${c.image}" alt="カード画像">`:'<div class="thumb"></div>'}<div style="min-width:0;flex:1"><div class="name">${esc(c.name)}</div><div class="muted">${esc(c.cardNo||'番号未登録')} / ${esc(c.rarity||'レアリティ未登録')}</div><div class="chip">必要 ${Number(c.wanted)||1} 枚</div> <span class="chip">${esc(c.priority||'中')}</span><div class="muted">${esc(c.version||'')}</div></div></div><div class="actions"><button class="secondary" data-edit="${esc(c.id)}">編集</button><button class="secondary" data-sold="${esc(c.id)}">相場を見る</button><button class="danger" data-del="${esc(c.id)}">削除</button></div></div>`).join(''):'<p class="muted">まだカードがありません。</p>';
$('cardList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editCard(b.dataset.edit));$('cardList').querySelectorAll('[data-sold]').forEach(b=>b.onclick=()=>{$('mercariTarget').value=b.dataset.sold;tab('mercari');renderSold()});$('cardList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('カードと紐づく価格・売却データを削除しますか？')){data.cards=data.cards.filter(c=>c.id!==b.dataset.del);data.prices=data.prices.filter(p=>p.cardId!==b.dataset.del);data.sold=data.sold.filter(p=>p.cardId!==b.dataset.del);persist()}});
renderSold();renderLinks();renderPrices();renderShops();}
function resetCard(){editId=null;cardImage=null;cardFile=null;$('formTitle').textContent='カードを登録';['cardName','cardNo','rarity','version'].forEach(x=>$(x).value='');$('wanted').value=1;$('priority').value='中';$('cardFile').value='';$('detailFile').value='';$('detailDebug').classList.add('hidden');$('detailStatus').textContent='';$('cropPanel').classList.add('hidden');$('cancelEdit').classList.add('hidden');$('cardOcrStatus').textContent='';}
function editCard(id){let c=getCard(id);if(!c)return;editId=id;cardImage=c.image||null;cardFile=null;$('formTitle').textContent='カードを編集';['name','cardNo','rarity','version','wanted','priority'].forEach(k=>$(k==='name'?'cardName':k).value=c[k]??(k==='wanted'?1:''));$('cardFile').value='';$('detailFile').value='';$('detailDebug').classList.add('hidden');$('detailStatus').textContent='';$('cropPanel').classList.toggle('hidden',!c.image);$('cardPreview').src=c.image||'';$('cancelEdit').classList.remove('hidden');tab('wishlist');window.scrollTo(0,0)}
$('cancelEdit').onclick=resetCard;
$('saveCard').onclick=async()=>{let name=$('cardName').value.trim();if(!name)return alert('カード名を入力してください');let wanted=Number($('wanted').value);if(!Number.isInteger(wanted)||wanted<1||wanted>999)return alert('必要枚数を1〜999で入力してください');let c=editId?getCard(editId):{id:uid(),created:Date.now()};if(!c)return;Object.assign(c,{name,cardNo:$('cardNo').value.trim(),rarity:$('rarity').value.trim(),version:$('version').value.trim(),wanted,priority:$('priority').value,game:'ヴァンガード',image:cardImage||null});if(!editId)data.cards.push(c);if(persist())resetCard()};
$('cardFile').onchange=async e=>{cardFile=e.target.files[0];if(!cardFile)return;try{cardImage=await cropImage(cardFile);$('cardPreview').src=cardImage;$('cropPanel').classList.remove('hidden');$('cardOcrStatus').textContent='白背景を自動除去しました。カード全体が写っているか確認してください。';}catch(err){$('cardOcrStatus').textContent='画像を読み込めませんでした: '+err.message}};
async function loadImage(source){let img=new Image(),url=typeof source==='string'?source:URL.createObjectURL(source);try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});return img}finally{if(typeof source!=='string')URL.revokeObjectURL(url)}}
function findCardBounds(img){const max=650,ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height;const ink=(xx,yy)=>{let i=(yy*w+xx)*4;return d[i+3]>100&&Math.min(d[i],d[i+1],d[i+2])<225};const cols=[],rows=[];for(let xx=0;xx<w;xx++){let n=0;for(let yy=0;yy<h;yy+=2)if(ink(xx,yy))n++;cols.push(n)}for(let yy=0;yy<h;yy++){let n=0;for(let xx=0;xx<w;xx+=2)if(ink(xx,yy))n++;rows.push(n)}const segments=(arr,threshold)=>{let found=[],start=-1;for(let i=0;i<=arr.length;i++){if(i<arr.length&&arr[i]>=threshold){if(start<0)start=i}else if(start>=0){if(i-start>=Math.max(5,Math.round(arr.length*.045)))found.push([start,i]);start=-1}}return found};let xs=segments(cols,Math.max(3,Math.round(h*.10))),ys=segments(rows,Math.max(3,Math.round(w*.10)));let best=null;for(let [l,r] of xs)for(let [t,b] of ys){let cw=r-l,ch=b-t,aspect=cw/ch;if(aspect<.57||aspect>.83||cw<w*.18||ch<h*.24)continue;let score=cw*ch;if(!best||score>best.score)best={l,r,t,b,score}};if(!best){let minX=w,minY=h,maxX=0,maxY=0;for(let yy=0;yy<h;yy+=2)for(let xx=0;xx<w;xx+=2)if(ink(xx,yy)){minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy)}if(maxX-minX<w*.12||maxY-minY<h*.12)return {sx:0,sy:0,sw:img.naturalWidth,sh:img.naturalHeight};best={l:minX,r:maxX+1,t:minY,b:maxY+1}}let pad=Math.max(2,Math.round(Math.min(best.r-best.l,best.b-best.t)*.012));return {sx:Math.max(0,best.l-pad)/ratio,sy:Math.max(0,best.t-pad)/ratio,sw:Math.min(w,best.r+pad)/ratio-Math.max(0,best.l-pad)/ratio,sh:Math.min(h,best.b+pad)/ratio-Math.max(0,best.t-pad)/ratio}}
async function cropImage(source){let img=await loadImage(source),b=findCardBounds(img),scale=Math.min(1,850/Math.max(b.sw,b.sh)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.sw*scale));c.height=Math.max(1,Math.round(b.sh*scale));c.getContext('2d').drawImage(img,b.sx,b.sy,b.sw,b.sh,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.84)}
$('cropCheck').onclick=async()=>{if(!cardFile)return;try{cardImage=await cropImage(cardFile);$('cardPreview').src=cardImage;$('cardOcrStatus').textContent='白背景を自動除去しました。'}catch(e){alert(e.message)}};

const shopNames=[['カードラッシュ','https://www.google.com/search?q=site%3Acardrush-vanguard.jp+'],['カードラボ','https://www.google.com/search?q=site%3Ac-labo-online.jp+'],['遊々亭','https://www.google.com/search?q=site%3Ayuyu-tei.jp+'],['ドラゴンスター','https://www.google.com/search?q=site%3Adorasuta.jp%2Fvanguard%2F+'],['通販のPAO','https://www.google.com/search?q=site%3Apao-onlineshop.com+']];
function renderLinks(){let c=getCard($('compareTarget').value),term=c?(c.cardNo||c.name):'';let mk=(name,url)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>`;$('shopLinks').innerHTML=shopNames.map(([n,p])=>mk(n,p+encodeURIComponent(term))).join('');$('marketLinks').innerHTML=mk('楽天市場','https://search.rakuten.co.jp/search/mall/'+encodeURIComponent('ヴァンガード '+term)+'/')+mk('Amazon','https://www.amazon.co.jp/s?k='+encodeURIComponent('ヴァンガード '+term));}
$('compareTarget').onchange=renderLinks;
$('mercariSearch').onclick=()=>{let c=getCard($('mercariTarget').value);if(!c)return alert('カードを登録してください');window.open('https://jp.mercari.com/search?keyword='+encodeURIComponent(c.name)+'&status=sold_out','_blank','noopener')};
// メルカリは参考価格のメモだけを保存します。画像OCR・自動相場集計は行いません。
$('manualAdd').onclick=()=>{const id=$('mercariTarget').value,p=Number($('manualPrice').value);if(!id)return alert('カードを選択してください');if(!Number.isFinite(p)||p<=0)return alert('価格を入力してください');data.sold.push({id:uid(),cardId:id,price:p,title:$('manualTitle').value.trim(),source:'手動メモ',created:Date.now()});if(persist()){$('manualPrice').value='';$('manualTitle').value=''}};
function renderSold(){const id=$('mercariTarget').value,rows=data.sold.filter(x=>x.cardId===id);$('mercariSummary').innerHTML=`<div class="panel"><h2>メルカリ参考メモ</h2><p class="muted">${rows.length}件の手動メモがあります。売却相場の自動算出は行いません。</p></div>`;$('mercariRecords').innerHTML=rows.slice().reverse().map(e=>`<div class="item"><div class="row"><b>${yen(e.price)}</b><span class="muted">${new Date(e.created||Date.now()).toLocaleDateString('ja-JP')}</span></div><p class="muted">${esc(e.title||'メモなし')}</p><div class="actions"><button class="secondary" data-soldedit="${esc(e.id)}">修正</button><button class="danger" data-solddelete="${esc(e.id)}">削除</button></div></div>`).join('');$('mercariRecords').querySelectorAll('[data-soldedit]').forEach(b=>b.onclick=()=>{let e=data.sold.find(x=>x.id===b.dataset.soldedit);let p=prompt('参考価格（円）',e.price);if(p===null)return;let n=Number(p);if(!Number.isFinite(n)||n<=0)return alert('正しい価格を入力してください');let t=prompt('メモ',e.title||'');if(t===null)return;e.price=n;e.title=t;persist()});$('mercariRecords').querySelectorAll('[data-solddelete]').forEach(b=>b.onclick=()=>{if(confirm('このメモを削除しますか？')){data.sold=data.sold.filter(x=>x.id!==b.dataset.solddelete);persist()}})};
$('mercariTarget').onchange=renderSold;
$('savePrice').onclick=()=>{let id=$('priceTarget').value,p=Number($('price').value);if(!id||!Number.isFinite(p)||p<0||$('price').value==='')return alert('カードと価格を入力してください');data.prices.push({id:uid(),cardId:id,kind:$('kind').value,source:$('sourceName').value.trim(),price:p,shipping:Number($('shipping').value)||0,stock:$('stock').value,condition:$('condition').value,note:$('itemNote').value,url:$('url').value,created:Date.now()});if(persist())$('price').value=''};
function renderPrices(){let id=$('compareTarget').value,rows=data.prices.filter(x=>x.cardId===id),online=rows.filter(x=>x.kind==='online'),best=online.filter(x=>x.stock!=='売り切れ').sort((a,b)=>(Number(a.price)+Number(a.shipping))-(Number(b.price)+Number(b.shipping)))[0];$('priceSummary').innerHTML=`<div class="panel"><h2>登録済み通販価格</h2><div class="price">${best?yen(Number(best.price)+Number(best.shipping)):'データなし'}</div><p class="muted">手動登録の送料込み参考最安値。在庫数・必要枚数は未照合です。</p></div>`;$('priceRecords').innerHTML=rows.slice().reverse().map(p=>`<div class="item"><div class="row"><b>${esc(p.source||'名称なし')}</b><b class="gold">${yen(Number(p.price)+Number(p.shipping))}</b></div><p class="muted">${esc(p.kind)} / 在庫: ${esc(p.stock||'不明')} / ${esc(p.note||'')}</p><div class="actions">${/^https?:\/\//.test(p.url||'')?`<a class="btn secondary" href="${esc(p.url)}" target="_blank" rel="noopener">商品ページ</a>`:''}<button class="danger" data-price-del="${esc(p.id)}">削除</button></div></div>`).join('');$('priceRecords').querySelectorAll('[data-price-del]').forEach(b=>b.onclick=()=>{if(confirm('価格情報を削除しますか？')){data.prices=data.prices.filter(p=>p.id!==b.dataset.priceDel);persist()}})};
function renderShops(){$('shopSettings').innerHTML=data.shops.map(s=>`<div class="row item"><span>${esc(s.name)}</span><button class="danger" data-shop-del="${esc(s.id)}">削除</button></div>`).join('');$('shopSettings').querySelectorAll('[data-shop-del]').forEach(b=>b.onclick=()=>{data.shops=data.shops.filter(s=>s.id!==b.dataset.shopDel);persist()})}
$('addShop').onclick=()=>{let n=$('newShop').value.trim();if(n){data.shops.push({id:uid(),name:n});$('newShop').value='';persist()}};
$('export').onclick=()=>{let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cpf-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let d=JSON.parse(await f.text());if(!Array.isArray(d.cards)||!Array.isArray(d.prices))throw Error('バックアップ形式が違います');if(!confirm('現在のデータをバックアップの内容で置き換えますか？'))return;d.shops=Array.isArray(d.shops)?d.shops:[];d.sold=Array.isArray(d.sold)?d.sold:[];let prev=data;data=d;if(!persist())data=prev;else resetCard()}catch(err){alert('読み込みに失敗: '+err.message)}finally{e.target.value=''}};
render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});


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
 return result.data.text||'';
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
 // OCRで読めた文章の最初のカード名候補を優先。ナビゲーションと項目名は除外。
 const candidatesName=lines.map(t=>t.replace(/^カード名\s*[:：]\s*/,'').trim()).filter(t=>t&&!ignore.test(t)&&/[ぁ-んァ-ヶ一-龠]/.test(t)&&t.length>=2&&!/^(?:スタンダード|カード番号|レアリティ|グレード|パワー|シールド|クリティカル|国家|種族|効果|テキスト|収録|商品|発売|価格|イラスト|カードリスト)/.test(t)&&!codePattern.test(codeNormalize(t))&&!/https?:|www\.|©|Copyright/i.test(t));
 let name=candidatesName[0]||'';
 name=name.replace(/\s*[（(][^）)]{1,30}[）)]\s*$/,'').trim();
 return {name,cardNo:code,rarity};
}
$('scanDetail').onclick=async()=>{
 const file=$('detailFile').files[0];if(!file)return alert('公式サイトの詳細画面スクリーンショットを選択してください');
 const btn=$('scanDetail');btn.disabled=true;btn.textContent='読み取り中…';ocrStatus('読み取りを開始しています…');
 try{
  const fullText=await recognize(file);
  if(!fullText.trim())throw Error('OCRで文字を検出できませんでした。画像の鮮明さを確認してください');
  ocrStatus('認識文字からカード情報を抽出中…');
  const parsed=extractDetail(fullText);
  if(parsed.name)$('cardName').value=parsed.name;
  if(parsed.cardNo)$('cardNo').value=parsed.cardNo;
  if(parsed.rarity)$('rarity').value=parsed.rarity;
  $('detailText').textContent='【読み取り全文】\n'+fullText;
  $('detailDebug').classList.remove('hidden');
  $('detailStatus').textContent=`候補：名前 ${parsed.name||'未検出'} / 番号 ${parsed.cardNo||'未検出'} / レアリティ ${parsed.rarity||'未検出'}。必ず確認・修正してください。`;
 }catch(e){$('detailStatus').textContent='読み取り失敗：'+e.message+'。手入力で登録できます。'}finally{btn.disabled=false;btn.textContent='詳細画面から名前・番号・レアリティを読み取る'}
};
