'use strict';
const el = id => document.getElementById(id);
const groups = [['金融',1,1],['財政と租税',2,11],['為替相場',12,13],['経済学史',14,15],['日本経済史',16,17]];
const storageKey = 'seikei-redsheet-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch {}
const openIds = new Set(Array.isArray(saved.open) ? saved.open : []);
const zoomSteps = [100,125,150,200,250,300];
let zoom = zoomSteps.includes(saved.zoom) ? saved.zoom : 100;
let num = 1, pages;
const pad = n => String(n).padStart(2,'0');
function persist() {
  try { localStorage.setItem(storageKey,JSON.stringify({open:[...openIds],page:num,zoom})); } catch {}
}
function menu(open) {
  document.body.classList.toggle('nav-open',open);
  el('shade').hidden = !open;
  el('openNav').setAttribute('aria-expanded',String(open));
  if(open) el('closeNav').focus();
  else if(document.activeElement.closest('aside')) el('openNav').focus();
}
function makeIndex() {
  groups.forEach(([name,start,end])=>{
    const h=document.createElement('h3'); h.className='group'; h.textContent=name; el('contents').append(h);
    for(let i=start;i<=end;i++){
      const button=document.createElement('button'); button.className='navrow'; button.dataset.page=i;
      const number=document.createElement('em'); number.textContent=pad(i);
      button.append(number,document.createTextNode(pages[i-1].title));
      button.onclick=()=>{menu(false);navigate(i);}; el('contents').append(button);
    }
  });
}
function place(node,[x,y,w,h]) {
  Object.assign(node.style,{left:x/595.28*100+'%',top:y/841.89*100+'%',width:w/595.28*100+'%',height:h/841.89*100+'%'});
}
function paintFields(focusId,part=0) {
  const fields=pages[num-1].fields;
  const frag=document.createDocumentFragment();
  fields.forEach((f,index)=>{
    const revealed=openIds.has(f.id);
    f.boxes.forEach((box,j)=>{
      const button=document.createElement('button');
      button.className='field '+f.kind+(revealed?' revealed':'');
      button.dataset.id=f.id; button.dataset.part=j;
      button.setAttribute('aria-label',revealed?('答え「'+f.value+'」を隠す'):('解答欄 '+(index+1)+' の答えを表示'));
      button.setAttribute('aria-pressed',String(revealed));
      place(button,box);
      if(f.kind==='write' && revealed){
        const value=f.id==='12-20'?['高','強'][j]:f.value;
        button.textContent=value;
        const ems=Array.from(value).reduce((n,c)=>n+(/[ -~]/.test(c)?.59:1),0);
        button.style.fontSize=(Math.min(10.5,box[3]*.9,(box[2]-.5)/ems)/595.28*100)+'cqw';
      }
      frag.append(button);
    });
    if(revealed && f.kind==='choice') f.marks.forEach(box=>{
      const ring=document.createElement('span');ring.className='mark';place(ring,box);frag.append(ring);
    });
  });
  el('fields').replaceChildren(frag);
  const count=fields.filter(f=>openIds.has(f.id)).length;
  el('progress').textContent=fields.length?'表示 '+count+' / '+fields.length+' 問':'閲覧ページ';
  el('toggleAll').disabled=!fields.length;
  el('toggleAll').textContent=count===fields.length && fields.length?'すべて隠す':'すべて表示';
  if(focusId) el('fields').querySelector('[data-id="'+focusId+'"][data-part="'+part+'"]')?.focus({preventScroll:true});
}
function flip(id,focus,part){
  if(openIds.has(id))openIds.delete(id);else openIds.add(id);
  paintFields(focus?id:null,part);persist();
}
el('fields').addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(btn){flip(btn.dataset.id,e.detail===0,btn.dataset.part);return;}
  // On small screens, accept a near miss beside a tiny field.
  if(!matchMedia('(pointer:coarse)').matches)return;
  let nearest=null,best=8;
  for(const b of el('fields').querySelectorAll('button')){
    const r=b.getBoundingClientRect(),d=Math.hypot(Math.max(r.left-e.clientX,0,e.clientX-r.right),Math.max(r.top-e.clientY,0,e.clientY-r.bottom));
    if(d<best){nearest=b;best=d;}
  }
  if(nearest)flip(nearest.dataset.id,false);
});
function scale(next,remember=true){
  const scroller=el('scroller'),old=zoom,fromX=scroller.scrollLeft,fromY=scroller.scrollTop;
  zoom=next;el('paper').style.width=zoom+'%';el('fit').textContent=zoom+'%';
  el('minus').disabled=zoom===100;el('plus').disabled=zoom===300;
  if(remember){scroller.scrollTo(fromX*zoom/old,fromY*zoom/old);persist();}
}
function navigate(n){
  if(!Number.isInteger(n)||n<1||n>pages.length)return;
  num=n;const p=pages[n-1], group=groups.find(g=>n>=g[1]&&n<=g[2]);
  el('title').textContent=p.title;el('folio').textContent=p.label;el('chap').textContent=group[0];
  el('position').textContent=pad(n);el('paperlabel').textContent=p.label+'　·　'+n+' / '+pages.length;
  el('pageimg').src='pages/'+pad(n)+'.svg';el('pageimg').alt=p.label+'　'+p.title+'の原本紙面';
  document.querySelectorAll('.navrow').forEach(b=>{if(Number(b.dataset.page)===n)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  el('prev').disabled=n===1;el('next').disabled=el('bottomNext').disabled=n===pages.length;
  el('scroller').scrollTo(0,0);paintFields();persist();
  history.replaceState(null,'','#p'+n);
}
el('toggleAll').onclick=()=>{
  const fields=pages[num-1].fields, clear=fields.every(f=>openIds.has(f.id));
  fields.forEach(f=>clear?openIds.delete(f.id):openIds.add(f.id));paintFields();persist();
};
el('prev').onclick=()=>navigate(num-1);el('next').onclick=()=>navigate(num+1);
el('bottomNext').onclick=()=>{navigate(num+1);el('title').scrollIntoView({block:'start'});};
el('plus').onclick=()=>scale(zoomSteps[zoomSteps.indexOf(zoom)+1]);
el('minus').onclick=()=>scale(zoomSteps[zoomSteps.indexOf(zoom)-1]);el('fit').onclick=()=>scale(100);
el('openNav').onclick=()=>menu(true);el('closeNav').onclick=el('shade').onclick=()=>menu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open'))menu(false);});
el('pageimg').onerror=()=>{el('error').hidden=false;};el('pageimg').onload=()=>{el('error').hidden=true;};
fetch('pages.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  pages=data;makeIndex();scale(zoom,false);
  const target=Number(location.hash.match(/^#p(\d+)$/)?.[1] || saved.page || 1);
  navigate(target>=1&&target<=pages.length?target:1);
}).catch(()=>{el('error').hidden=false;});
