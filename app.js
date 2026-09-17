(() => {
'use strict';
const C=MyRateConfig,Calc=MyRateCalculator,S=MyRateStorage,K=MyRateCollections,U=MyRateInterface,$=id=>document.getElementById(id),clone=S.clone,stamp=()=>new Date().toISOString();
let state=S.load(),items=[],unit='hours',openedFavorite=null,openedProject=null,previousScreen='Current',archiveTab='calculations',selectionMode=false,selected=new Set(),toastTimer,magicTimer,magicHideTimer,introActive=false,introHiddenAt=0;
const wheelValues={},wheelDefs={},bags={};
let lastSaved=clone(state), busy=false, savingCurrent=false, setupOpen=false, firstWish=false;
let navControl=null, favoriteOrigin='Favorites', projectOrigin='Projects', profileReturn='Current';
let searchScope='all', searchRelease=null, searchScroll=0, sheetRelease=null;

const activeCalcs=()=>state.calculations.filter(x=>x.status!=='archived'),activeProjects=()=>state.projects.filter(x=>x.status!=='archived'),find=(a,id)=>a.find(x=>x.id===id);
const privacy=()=> 'Сумма, карточки и Большие планы сохраняются на '+(/iPhone/i.test(navigator.userAgent)?'этом iPhone.':'этом устройстве.')+' Для курсов валют обращаемся к отдельному сервису — без сумм и названий.';
function save() {
  if (S.save(state)) { lastSaved=clone(state); return true; }
  state=clone(lastSaved);
  toast('Не удалось сохранить данные на устройстве. Ничего не удалено. Попробуй освободить место.');
  renderAll();
  return false;
}
function commit(next) {
  const before=state; state=next;
  if(save()) return true;
  state=before; return false;
}
function copy(key){const a=C.copy[key]||['Готово.'];if(!bags[key]?.length)bags[key]=[...a].sort(()=>Math.random()-.5);return bags[key].pop();}
function toast(text,key) {
  clearTimeout(toastTimer);
  const neutral={itemAdded:'Позиция добавлена.',favoriteSaved:'Карточка сохранена в «Избранном».',projectSaved:'План сохранён в «Больших планах».',renamed:'Название изменено.',edited:'Изменения сохранены.',deleted:'Удалено.',archived:'Перемещено в Архив.',restored:'Восстановлено из Архива.',currentEdited:'Позиция изменена.',currentCopied:'Копия добавлена в текущий список.',currentRemoved:'Позиция убрана из текущего списка.'};
  const message=text||(!state.settings.jokes&&neutral[key]?neutral[key]:copy(key));
  const duration=Math.min(C.toastMaxMs,Math.max(C.toastMinMs,2600+message.length*48));
  $('toast').textContent=message;$('toast').classList.remove('hidden');
  toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),duration);
}
async function magic(key, fn) {
  if(busy) return false;
  busy=true; updateFormButtons();
  const overlay=$('magicOverlay'),animated=state.settings.magic&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const locked=[$('app'),$('bottomNav')],before=locked.map(el=>el.inert);
  locked.forEach(el=>el.inert=true);$('app').setAttribute('aria-busy','true');
  try {
    if(animated) {
      const max=key==='fx'?C.magicFxMaxMs:C.magicMaxMs;
      $('magicText').textContent=copy(state.settings.jokes?key:'neutral');
      overlay.classList.remove('hidden');
      requestAnimationFrame(()=>overlay.classList.add('is-visible'));
      await new Promise(resolve=>setTimeout(resolve,C.magicMinMs+Math.random()*(max-C.magicMinMs)));
    }
    // Keep the overlay/input lock while a rate request is in flight.
    await fn?.();
    if(animated) {
      overlay.classList.remove('is-visible');
      await new Promise(resolve=>setTimeout(resolve,C.magicFadeMs));
    }
    return true;
  } catch { toast('Не получилось завершить действие. Проверь данные и попробуй ещё раз.'); return false; }
  finally {
    overlay.classList.add('hidden');overlay.classList.remove('is-visible');
    locked.forEach((el,i)=>el.inert=before[i]);$('app').removeAttribute('aria-busy');
    busy=false;updateFormButtons();
  }
}
function closeHelp(){$('helpPopover').classList.add('hidden')}
function dismissKeyboard(){document.activeElement?.blur?.();document.body.classList.remove('keyboard-open')}
function runIntro(mode='launch') {
  if(introActive)return;
  const intro=$('introScreen'),title=$('introTitle');
  const theme=document.querySelector('meta[name="theme-color"]');
  const isReturn=mode==='return',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const holdMs=isReturn?C.introReturnHoldMs:C.introHoldMs;
  const brandMs=isReturn?C.introReturnBrandMs:C.introBrandMs;
  const started=performance.now();
  let leaving=false,exitTimer,brandTimer,finishTimer;

  const finish=()=>{
    clearTimeout(exitTimer);clearTimeout(brandTimer);clearTimeout(finishTimer);
    intro.removeEventListener('pointerup',skip);document.removeEventListener('keydown',key);
    intro.classList.add('hidden');
    document.documentElement.classList.remove('intro-pending');
    document.body.classList.remove('intro-running','intro-handoff','intro-reduced');
    theme.content='#f2f0ea';introActive=false;
    requestAnimationFrame(maybeOpenMeaning);
  };
  const revealDestination=()=>{
    document.documentElement.classList.remove('intro-pending');
    document.body.classList.add('intro-handoff');
    theme.content='#f2f0ea';
    if(!meaningSeen())openMeaning();
    requestAnimationFrame(()=>requestAnimationFrame(()=>intro.classList.add('is-leaving')));
    finishTimer=setTimeout(finish,reduced?620:C.introExitMs+80);
  };
  const leave=()=>{
    if(leaving)return;
    leaving=true;clearTimeout(exitTimer);clearTimeout(brandTimer);
    intro.classList.add('is-branded');
    requestAnimationFrame(()=>requestAnimationFrame(revealDestination));
  };
  const skip=()=>{if(performance.now()-started>=C.introSkipDelayMs)leave();};
  const key=e=>{if(['Escape','Enter',' '].includes(e.key))skip();};

  introActive=true;intro.className='intro-screen hidden';intro.removeAttribute('style');
  title.className='intro-title';title.removeAttribute('style');
  document.documentElement.classList.add('intro-pending');
  document.body.classList.add('intro-running');
  theme.content='#10100f';
  if(reduced){intro.classList.add('is-reduced');document.body.classList.add('intro-reduced');}
  intro.classList.remove('hidden');
  requestAnimationFrame(()=>intro.classList.add('is-running'));
  brandTimer=setTimeout(()=>intro.classList.add('is-branded'),reduced?900:brandMs);
  exitTimer=setTimeout(leave,reduced?1800:holdMs);
  intro.addEventListener('pointerup',skip);document.addEventListener('keydown',key);
}
function setupIntroLifecycle(){const remember=()=>{introHiddenAt=Date.now()},resume=()=>{if(!introHiddenAt)return;const awayFor=Date.now()-introHiddenAt;introHiddenAt=0;if(awayFor>=C.introReturnAfterMs)runIntro('return')};document.addEventListener('visibilitychange',()=>{if(document.hidden)remember();else resume()});window.addEventListener('pagehide',remember);window.addEventListener('pageshow',event=>{if(event.persisted)resume()})}
function showHelp(btn){const box=$('helpPopover'),text=(C.help[btn.dataset.help]||'').replace('{privacy}',privacy());if(!text||(!box.classList.contains('hidden')&&box.dataset.for===btn.dataset.help)){closeHelp();return}box.textContent=text;box.dataset.for=btn.dataset.help;box.classList.remove('hidden');const r=btn.getBoundingClientRect(),w=Math.min(320,innerWidth-28);box.style.width=w+'px';box.style.left=Math.max(14,Math.min(innerWidth-w-14,r.right-w))+'px';box.style.top=Math.min(innerHeight-box.offsetHeight-14,r.bottom+8)+'px'}

const stories=[
 {title:'Ценник умеет притворяться',text:'MyRate переводит стоимость вещей в твоё рабочее время. Сначала настроим ритм, потом примерим хотелку.',rows:[['Наушники','8 000 ₽'],['Это для тебя','10 часов работы']],note:'Пример: при 800 ₽ за рабочий час.'},
 {title:'Настрой свою математику',text:'Укажи сумму, период и обычный рабочий график. Позже всё можно изменить через шестерёнку.',rows:[['Сумма','6 400 ₽'],['Период','Рабочий день'],['График','5 дней · 8 часов']],note:'Это пример. В приложении вводи свои значения.'},
 {title:'На что запал глаз?',text:'Название, цена одной штуки, валюта и количество. Заполни всё — кнопка «Добавить» станет активной.',rows:[['На что запал глаз?','Наушники'],['Что на ценнике?','8 000 ₽'],['Количество','1']],note:'Количество нужно указать, даже если нужна одна штука.'},
 {title:'Вот и фокус',text:'Задержи палец на барабане и двигай вверх-вниз, не отрывая. Отпусти — выбранная единица сохранится.',rows:[['Минуты работы','600'],['Часы работы','10'],['Рабочие дни','1,25']],note:'Быстрый свайп прокручивает страницу. Удержание включает барабан.'},
 {title:'Чтобы не потерять',text:'Сохрани результат в «Избранное». Через три точки можно переименовать карточку или изменить её детали.',rows:[['Избранное','Наушники · 10 часов'],['Меню карточки','Переименовать'],['Меню карточки','Изменить детали']],note:'После сохранения текущая форма очищается.'},
 {title:'У хотелки появилась компания',text:'В «Избранном» удерживай карточку, чтобы включить выбор. Коснись второй — появится «Объединить выбранные».',rows:[['✓ Наушники','10 часов'],['✓ Кроссовки','15 часов'],['Большой план','25 часов работы']],note:'Повторное нажатие снимает выбор. «Отмена» снимает весь выбор.'},
 {title:'Теперь можно прицениться',text:'Шестерёнка — рабочий ритм и настройки. Лупа — поиск. Архив — то, что пока отложено. Эти истории всегда доступны в настройках и FAQ.',rows:[['Настройки','Рабочий ритм'],['Поиск','Карточки и планы'],['Архив','Отложенные хотелки']],note:'No doubt. Just PROBA.'}
];
let storyIndex=0,storyRelease=null,storyScroll=0;
function paintStory(){
 const s=stories[storyIndex],layer=$('storyLayer');
 $('storyProgress').replaceChildren(...stories.map((_,i)=>{const el=document.createElement('span');el.className=i<=storyIndex?'seen':'';return el;}));
 $('storyCount').textContent=(storyIndex+1)+' / '+stories.length;
 $('storyTitle').textContent=s.title;$('storyText').textContent=s.text;$('storyNote').textContent=s.note;
 paintStoryExample(s);
 $('storyPrevious').disabled=storyIndex===0;$('storyNext').textContent=storyIndex===stories.length-1?'Попробовать':'Дальше';
 $('storyHint').textContent=storyIndex===0?'Листай, когда разобрался':'Свайп влево — дальше · вправо — назад';
 $('storyBody').scrollTop=0;
}
function paintStoryExample(s){
 const example=$('storyExample');
 if(storyIndex!==3){
  example.className='';
  example.replaceChildren(...s.rows.map(([label,value])=>{const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value;row.append(a,b);return row;}));
  return;
 }
 example.className='story-wheel-example';
 const result=document.createElement('div');result.className='story-result-preview';
 const resultLabel=document.createElement('span');resultLabel.textContent='Наушники · 8 000 ₽';
 const resultValue=document.createElement('strong');resultValue.textContent='10 часов работы';
 result.append(resultLabel,resultValue);
 const block=document.createElement('div');block.className='field-block result-wheel-block';
 const label=document.createElement('div');label.className='label-row wheel-field-label centered';
 const labelText=document.createElement('span');labelText.textContent='Показать стоимость в…';label.append(labelText);
 const wheel=document.createElement('div');wheel.className='wheel unit-wheel story-wheel is-demonstrating';wheel.setAttribute('aria-label','Пример настоящего барабана единиц результата');
 const center=document.createElement('div');center.className='wheel-center';
 const options=document.createElement('div');options.className='wheel-options';
 const values=['Рабочие годы','Минуты работы','Часы работы','Рабочие дни','Рабочие недели'];
 values.forEach((value,index)=>{const option=document.createElement('div'),distance=index-2,y=(distance+1)*42,closeness=Math.max(0,1-Math.min(Math.abs(y-42)/42,1));option.className='wheel-option'+(distance===0?' is-focus':'');option.dataset.distance=String(distance);option.textContent=value;option.style.transform=`translateY(${y}px) scale(${.92+closeness*.16})`;option.style.opacity=String(.5+closeness*.5);option.setAttribute('aria-selected',distance===0?'true':'false');options.append(option)});
 wheel.append(center,options);block.append(label,wheel);example.replaceChildren(result,block);
}
function openStories(){
 if(storyRelease)return;
 dismissKeyboard();closeHelp();storyScroll=scrollY;storyIndex=0;
 $('storyLayer').classList.remove('hidden');document.body.classList.add('stories-open');
 storyRelease=U.focusLayer($('storyLayer'),closeStories);paintStory();
}
function closeStories(){
 if(!storyRelease)return;
 $('storyLayer').classList.add('hidden');document.body.classList.remove('stories-open');
 const release=storyRelease;storyRelease=null;release();scrollTo({top:storyScroll,behavior:'instant'});
}
function stepStory(delta){
 const next=storyIndex+delta;
 if(next>=stories.length){closeStories();return;}
 if(next<0)return;storyIndex=next;paintStory();
}
function setupStories(){
 $('skipTourIntro').onclick=openStories;$('restartTour').onclick=openStories;$('faqStories').onclick=openStories;
 $('storyClose').onclick=closeStories;$('storyNext').onclick=()=>stepStory(1);$('storyPrevious').onclick=()=>stepStory(-1);
 const layer=$('storyLayer');let start=null;
 layer.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
 layer.addEventListener('touchend',e=>{if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)stepStory(dx<0?1:-1);},{passive:true});
 layer.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 layer.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stepStory(e.key==='ArrowRight'?1:-1);}});
}

const meaningSlides=[
 {scene:'price',title:'У ценника есть привычка недоговаривать.',text:'Он показывает сумму. Но молчит о том, сколько твоего времени понадобилось, чтобы эта сумма появилась.'},
 {scene:'scales',title:'Одна цена — разная стоимость.',text:'Одна и та же сумма для одного человека — несколько рабочих дней. Для другого — месяц. Денежный ценник общий. Второй — личный.'},
 {scene:'light',title:'Мы не запрещаем. Мы включаем свет.',text:'Иногда вещь действительно стоит потраченного времени. Иногда — нет. MyRate не решает за тебя. Он делает невидимое видимым.'},
 {scene:'time',title:'Сегодня — ценники. Дальше — время.',text:'Сейчас MyRate переводит цену вещей в рабочее время. Но сам вопрос шире: куда уходят наши дни, внимание и выборы? Мы начинаем с простого ценника.'},
 {scene:'final',title:'У каждой вещи есть второй ценник.',text:'На нём написано твоё время.',final:'Не чтобы отговорить тебя. Чтобы решение действительно было твоим.'}
];
let meaningIndex=0,meaningRelease=null,meaningScroll=0;
function meaningSeen(){return Number(state.onboarding?.meaningVersionSeen||0)>=C.meaningVersion;}
function markMeaningSeen(){
 if(meaningSeen())return true;
 const next=clone(state);next.onboarding={...next.onboarding,meaningVersionSeen:C.meaningVersion};
 return commit(next);
}
function paintMeaning(){
 const s=meaningSlides[meaningIndex],final=meaningIndex===meaningSlides.length-1,visual=$('meaningVisual'),layer=$('meaningLayer');
 $('meaningProgress').replaceChildren(...meaningSlides.map((_,i)=>{const el=document.createElement('span');el.className=i<=meaningIndex?'seen':'';return el;}));
 $('meaningCount').textContent=(meaningIndex+1)+' / '+meaningSlides.length;
 $('meaningTitle').textContent=s.title;$('meaningText').textContent=s.text;$('meaningFinalText').textContent=s.final||'';
 $('meaningFinalText').classList.toggle('hidden',!final);$('meaningBrand').classList.toggle('hidden',!final);
 $('meaningStandardActions').classList.toggle('hidden',final);$('meaningFinalActions').classList.toggle('hidden',!final);
 $('meaningPrevious').disabled=meaningIndex===0;
 $('meaningHint').textContent=final?'Выбор остаётся за тобой':meaningIndex===0?'Листай, когда мысль уложилась':'Свайп влево — дальше · вправо — назад';
 visual.dataset.scene=s.scene;visual.classList.remove('is-entering');void visual.offsetWidth;visual.classList.add('is-entering');
 $('meaningBody').scrollTop=0;
}
function openMeaning(){
 if(meaningRelease||storyRelease)return;
 dismissKeyboard();closeHelp();meaningScroll=scrollY;meaningIndex=0;
 $('meaningLayer').classList.remove('hidden');document.body.classList.add('meaning-open');
 meaningRelease=U.focusLayer($('meaningLayer'),closeMeaning);paintMeaning();
}
function closeMeaning(){
 if(!meaningRelease)return;
 markMeaningSeen();$('meaningLayer').classList.add('hidden');document.body.classList.remove('meaning-open');
 const release=meaningRelease;meaningRelease=null;release();scrollTo({top:meaningScroll,behavior:'instant'});
}
function stepMeaning(delta){
 const next=meaningIndex+delta;if(next<0||next>=meaningSlides.length)return;
 meaningIndex=next;paintMeaning();
}
function enterMyRate(){
 closeMeaning();switchScreen('Current');
 if(!Calc.isValidProfile(state.profile||{})){setupOpen=true;renderProfileStage();}
 scrollTo({top:0,behavior:'instant'});
}
function learnMyRate(){
 closeMeaning();openStories();
}
function maybeOpenMeaning(){if(!meaningSeen())openMeaning();}
function setupMeaning(){
 $('faqMeaning').onclick=openMeaning;$('meaningClose').onclick=closeMeaning;
 $('meaningNext').onclick=()=>stepMeaning(1);$('meaningPrevious').onclick=()=>stepMeaning(-1);$('meaningFinalBack').onclick=()=>stepMeaning(-1);
 $('meaningLearn').onclick=learnMyRate;$('meaningTry').onclick=enterMyRate;
 const layer=$('meaningLayer');let start=null;
 layer.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
 layer.addEventListener('touchend',e=>{if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)stepMeaning(dx<0?1:-1);},{passive:true});
 layer.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 layer.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stepMeaning(e.key==='ArrowRight'?1:-1);}});
}
function dialog({title,text='',body=null,actions=[{label:'Понятно',value:true,primary:true}]}) {
  closeSheet();
  return new Promise(resolve=>{
    const layer=$('dialogLayer'), buttons=[];
    $('dialogTitle').textContent=title; $('dialogText').textContent=text;
    $('dialogBody').replaceChildren(); if(body)$('dialogBody').append(body);
    $('dialogActions').replaceChildren();
    let closed=false,release=()=>{};
    const close=value=>{
      if(closed)return; closed=true; dismissKeyboard(); layer.classList.add('hidden'); release(); resolve(value);
    };
    const refresh=()=>buttons.forEach(({button,action})=>button.disabled=action.enabled?!action.enabled():false);
    actions.forEach(action=>{
      const button=document.createElement('button'); button.type='button';
      button.className='button '+(action.primary?'primary':'secondary')+(action.danger?' danger':'');
      button.textContent=action.label;
      button.onclick=()=>{ if(action.validate&&!action.validate())return; close(action.value); };
      buttons.push({button,action}); $('dialogActions').append(button);
    });
    if(body)['input','change','click'].forEach(type=>body.addEventListener(type,refresh));
    refresh(); $('dialogClose').onclick=()=>close(null);
    layer.onclick=e=>{if(e.target===layer)close(null);};
    layer.classList.remove('hidden'); release=U.focusLayer(layer,()=>close(null));
  });
}
async function confirm(title,text,ok='Подтвердить'){return await dialog({title,text,actions:[{label:'Не надо',value:false},{label:ok,value:true,primary:true}]})===true}
async function ask(title,text,value='',kind='title'){const input=document.createElement('input');input.className='dialog-input';input.maxLength=80;input.value=value;input.placeholder='Название';input.required=true;input.setAttribute('aria-required','true');const project=kind==='project',result=await dialog({title,text,body:input,actions:[{label:'Отмена',value:false},{label:'Сохранить',value:true,primary:true,enabled:()=>Boolean(input.value.trim()),validate:()=>validateFields([{input,label:project?'название плана':'название',emptyKey:project?'requiredProjectTitle':'requiredTitle'}])}]});return result?input.value.trim():null}
function closeSheet() {
  $('sheetLayer').classList.add('hidden');
  if(sheetRelease){const release=sheetRelease;sheetRelease=null;release();}
}
function sheet(title,actions) {
  closeSheet(); closeHelp();
  const layer=$('sheetLayer'); $('sheetTitle').textContent=title; $('sheetActions').replaceChildren();
  actions.filter(Boolean).forEach(action=>{
    const b=document.createElement('button');b.className='sheet-action'+(action.danger?' danger':'');
    b.type='button';b.textContent=action.label;b.disabled=Boolean(action.disabled);
    b.onclick=()=>{closeSheet();action.run?.();};$('sheetActions').append(b);
  });
  $('sheetCancel').onclick=closeSheet;layer.onclick=e=>{if(e.target===layer)closeSheet();};
  layer.classList.remove('hidden');sheetRelease=U.focusLayer(layer,closeSheet);
}
function sanitize(input){let v=input.value.replace(/\s/g,'').replace(/[^0-9.,]/g,'').replace(',','.');const i=v.indexOf('.');if(i>=0)v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,'');input.value=v}
function num(id){return Number($(id).value.replace(',','.'))}
function validNumber(input) {
  const raw=input.value.trim().replace(',','.');
  if(!raw || !/^\d+(?:\.\d*)?$/.test(raw))return false;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=Number(input.dataset.min)&&value<=Number(input.dataset.max);
}
function clearFieldError(input){input.classList.remove('field-error');input.removeAttribute('aria-invalid')}
function markFieldError(input){input.classList.remove('field-error');void input.offsetWidth;input.classList.add('field-error');input.setAttribute('aria-invalid','true')}
function validateFields(rules){const errors=[];rules.forEach(rule=>{const empty=!String(rule.input.value??'').trim(),invalid=!empty&&rule.valid&&!rule.valid(rule.input);if(empty||invalid){markFieldError(rule.input);errors.push({...rule,key:empty?rule.emptyKey:rule.invalidKey||rule.emptyKey})}else clearFieldError(rule.input)});if(!errors.length)return true;const first=errors[0];if(errors.length===1)toast(null,first.key);else toast(`${copy('requiredMany')} ${errors.map(x=>x.label).join(', ')}.`);return false}
function profileFormReady(){return[$('income'),$('days'),$('hours')].every(validNumber)}
function itemFormReady(){return Boolean($('itemName').value.trim())&&validNumber($('itemPrice'))&&validNumber($('itemQty'))}
function updateFormButtons() {
  $('saveProfile').disabled=busy||!profileFormReady();
  $('addItem').disabled=busy||!itemFormReady();
  $('saveCalculation').disabled=busy||savingCurrent||!items.length;
}

function setupWheel(name,map,onChange){wheelValues[name]??=Object.keys(map)[0];wheelDefs[name]={entries:Object.entries(map),onChange,commitTimer:null,committedValue:wheelValues[name]};renderWheel(name);}
function paintWheel(root){const offset=Number(root.dataset.offset||0),active=root.classList.contains('is-active'),options=[...root.querySelectorAll('.wheel-option')],position=option=>(Number(option.dataset.distance)+1)*42+offset,focus=options.reduce((best,option)=>Math.abs(position(option)-42)<Math.abs(position(best)-42)?option:best,options[0]);options.forEach(option=>{const y=position(option),distance=Math.abs(y-42)/42,closeness=Math.max(0,1-Math.min(distance,1)),scale=.92+closeness*(active?.25:.16),selected=option===focus;option.style.transform=`translateY(${y}px) scale(${scale})`;option.style.opacity=String(.5+closeness*.5);option.classList.toggle('is-focus',selected);option.setAttribute('aria-selected',selected?'true':'false')})}
function settleWheel(name){const root=document.querySelector(`[data-wheel="${name}"]`),def=wheelDefs[name];if(!root||!def)return;clearTimeout(def.commitTimer);root.classList.remove('is-active','is-dragging');root.classList.add('is-settling');root.dataset.offset='0';paintWheel(root);def.commitTimer=setTimeout(()=>{root.classList.remove('is-settling');if(def.committedValue!==wheelValues[name]){def.committedValue=wheelValues[name];learnedWheel();def.onChange?.(wheelValues[name])}},C.wheelSettleMs)}
function renderWheel(name){const root=document.querySelector(`[data-wheel="${name}"]`),def=wheelDefs[name];if(!root||!def)return;let box=root.querySelector('.wheel-options');if(!box){root.replaceChildren();const center=document.createElement('div');center.className='wheel-center';box=document.createElement('div');box.className='wheel-options';[-2,-1,0,1,2].forEach(d=>{const option=document.createElement('div');option.className='wheel-option';option.dataset.distance=d;option.setAttribute('role','option');box.append(option)});root.append(center,box);root.dataset.offset='0';root.tabIndex=0;root.setAttribute('role','listbox');bindWheelGesture(root,name)}const n=def.entries.length,index=Math.max(0,def.entries.findIndex(x=>x[0]===wheelValues[name]));[...box.children].forEach((option,slot)=>{const d=slot-2,idx=(index+d+n)%n,[value,label]=def.entries[idx];option.dataset.distance=d;option.dataset.value=value;option.textContent=label});paintWheel(root)}
function previewWheel(name,value){wheelValues[name]=value;renderWheel(name)}
function selectWheel(name,value,fire=false){wheelValues[name]=value;wheelDefs[name].committedValue=value;renderWheel(name);if(fire)wheelDefs[name].onChange?.(value)}
function bindWheelGesture(root,name){if(root.dataset.gestureBound)return;root.dataset.gestureBound='1';let holdTimer,startY=0,lastY=0,offset=0,active=false;const shift=direction=>{const a=wheelDefs[name].entries,i=a.findIndex(x=>x[0]===wheelValues[name]),next=(i+direction+a.length)%a.length;root.dataset.offset=String(offset);previewWheel(name,a[next][0])};const activate=()=>{root.classList.remove('is-demonstrating');active=true;clearTimeout(wheelDefs[name].commitTimer);root.classList.remove('is-settling');root.classList.add('is-active');try{navigator.vibrate?.(6)}catch{};paintWheel(root)};const finish=()=>{clearTimeout(holdTimer);if(!active)return;active=false;if(offset<=-21){offset+=42;shift(1)}else if(offset>=21){offset-=42;shift(-1)}root.dataset.offset=String(offset);settleWheel(name);offset=0};root.addEventListener('contextmenu',e=>e.preventDefault());root.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;startY=lastY=e.touches[0].clientY;offset=Number(root.dataset.offset||0);active=false;clearTimeout(holdTimer);holdTimer=setTimeout(activate,C.wheelHoldMs)},{passive:true});root.addEventListener('touchmove',e=>{if(e.touches.length!==1)return;const y=e.touches[0].clientY;if(!active){if(Math.abs(y-startY)>8)clearTimeout(holdTimer);return}e.preventDefault();if(!root.classList.contains('is-dragging'))root.classList.add('is-dragging');offset+=y-lastY;lastY=y;while(offset<=-42){offset+=42;shift(1)}while(offset>=42){offset-=42;shift(-1)}root.dataset.offset=String(offset);paintWheel(root)},{passive:false});root.addEventListener('touchend',finish,{passive:true});root.addEventListener('touchcancel',finish,{passive:true});root.addEventListener('wheel',e=>{e.preventDefault();const a=wheelDefs[name].entries,i=a.findIndex(x=>x[0]===wheelValues[name]),next=(i+(e.deltaY>0?1:-1)+a.length)%a.length;previewWheel(name,a[next][0]);settleWheel(name)},{passive:false});root.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const a=wheelDefs[name].entries,i=a.findIndex(x=>x[0]===wheelValues[name]),next=(i+(e.key==='ArrowDown'?1:-1)+a.length)%a.length;previewWheel(name,a[next][0]);settleWheel(name)})}

function profileFromForm(){return{income:num('income'),currency:wheelValues.incomeCurrency,period:wheelValues.period,days:num('days'),hours:num('hours')}}
function fillProfile(p){if(!p)return;$('income').value=p.income;$('days').value=p.days;$('hours').value=p.hours;selectWheel('incomeCurrency',p.currency);selectWheel('period',p.period);updateFormButtons()}
async function fetchFx(base,force=false) {
  if(!force&&state.fx?.base===base&&Date.now()-state.fx.savedAt<C.fxMaxAgeMs)return clone(state.fx);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {
    const r=await fetch(C.fxEndpoint+encodeURIComponent(base),{signal:controller.signal});
    if(!r.ok)throw Error('fx');
    const d=await r.json();
    if(d.result!=='success'||!d.rates)throw Error('fx');
    const rates={};Object.entries(d.rates).forEach(([key,value])=>{if(Number.isFinite(Number(value))&&Number(value)>0)rates[key]=Number(value);});
    rates[base]=1;
    return {base,rates,updated:d.time_last_update_unix||Math.floor(Date.now()/1000),savedAt:Date.now()};
  } finally {clearTimeout(timer);}
}
async function ensureCurrentFx(force=false) {
  if(!state.profile)return;
  const base=state.profile.currency;
  try {
    const fx=await fetchFx(base,force);
    if(state.profile.currency!==base)return;
    const next=clone(state);next.fx=fx;if(!commit(next))return;
    $('fxStatus').textContent='Курсы валют: '+date(fx.updated*1000);
  } catch { $('fxStatus').textContent=state.fx?.base===base?'Используем последний сохранённый курс.':'В своей валюте считать можно. Для других нужен интернет.'; }
}
async function saveProfile() {
  if(busy||!profileFormReady())return;
  const profile=profileFromForm(),old=state.profile;if(!Calc.isValidProfile(profile))return;
  let mode='new';
  if(old&&Calc.isValidProfile(old)) {
    mode=await dialog({title:'Что пересчитать с новым ритмом?',text:'Новые карточки и текущий список получат новый ритм. Сохранённые результаты изменятся только по твоему выбору.',actions:[
      {label:'Отменить изменения',value:'cancel'},{label:'Только новые карточки',value:'new'},
      {label:'Пересчитать всё активное',value:'all',primary:true}]});
    if(!mode||mode==='cancel')return;
  }
  busy=true;updateFormButtons();
  try {
    let fx=state.fx?.base===profile.currency?clone(state.fx):null;
    if(!fx) {try{fx=await fetchFx(profile.currency);}catch{/* Same-currency results are available offline. */}}
    const next=clone(state);next.profile=profile;next.fx=fx;
    if(mode==='all') {
      const targets=[...next.calculations.filter(c=>c.status!=='archived'),...next.projects.filter(p=>p.status!=='archived').flatMap(p=>p.calculations)];
      if(targets.some(c=>c.items.some(it=>it.currency!==profile.currency&&!fx?.rates?.[it.currency]))) {
        toast('Для пересчёта всех карточек нужен курс валют. Ничего не изменено.');return;
      }
      targets.forEach(c=>{c.profile=clone(profile);c.fx=fx?clone(fx):null;c.updatedAt=stamp();});
      next.projects.filter(p=>p.status!=='archived').forEach(p=>p.updatedAt=stamp());
    }
    if(!commit(next))return;
    firstWish=!old;setupOpen=false;
    selectWheel('itemCurrency',profile.currency);
    renderProfileStage();switchScreen('Current');renderAll();
    $('fxStatus').textContent=fx?'Курсы валют: '+date(fx.updated*1000):'В своей валюте считаем без интернета.';
    if(mode==='all')toast('Новый ритм принят. Всё активное пересчитано.');
  } finally {busy=false;updateFormButtons();}
}

function autoTitle(a){return a.length===1?a[0].name:a.slice(0,2).map(x=>x.name).join(' + ')+(a.length>2?` + ещё ${a.length-2}`:'')}
function summaryOfItems(a,p=state.profile,fx=state.fx){return Calc.calculationSummary({items:a,profile:p,fx})}
function itemHtml(it,p,fx,u,removable=false) {
  p=Calc.normalizeProfile(p||{});
  const s=Calc.itemSummary(it,p,fx);
  const meta=Calc.formatNumber(it.qty,2)+' × '+Calc.money(it.price,it.currency)+(it.currency!==p.currency&&Number.isFinite(s.money)?' ≈ '+Calc.money(s.money,p.currency):'');
  const card=document.createElement('article');card.className='item-card';card.dataset.itemId=it.id;
  const head=document.createElement('div');head.className='item-head';
  const title=document.createElement('div');title.className='item-title';title.textContent=it.name;head.append(title);
  if(removable){const b=document.createElement('button');b.type='button';b.className='dots-button';b.setAttribute('aria-label','Действия: '+it.name);b.innerHTML=U.icon('more');b.onclick=()=>currentItemMenu(it.id);head.append(b);U.hold(card,()=>currentItemMenu(it.id));}
  const result=document.createElement('div');result.className='item-result';result.textContent=Calc.smart(Calc.unitValue(s.hours,u,p),u);
  const desc=document.createElement('div');desc.className='item-meta';desc.textContent=meta;card.append(head,result,desc);return card;
}
function renderItemList(box,a,p,fx,u,removable=false){box.replaceChildren();a.forEach(it=>box.append(itemHtml(it,p,fx,u,removable)));}
function renderCurrent() {
  if(!state.profile)return;
  const n=items.length;
  $('currentTitle').textContent=n?n+' '+(n%10===1&&n%100!==11?'позиция':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'позиции':'позиций'):'Пока пусто';
  $('clearItems').classList.toggle('hidden',!n);$('saveCalculation').classList.toggle('hidden',!n);
  $('saveCalculation').textContent=n>1?'Куда это всё?':'Добавить в избранное';
  $('currentUnitPicker').classList.toggle('hidden',!n);
  $('multipleHint').classList.toggle('hidden',n<2);
  $('firstWishGuide').classList.toggle('hidden',!firstWish||n>0);
  if(!n)$('itemsList').innerHTML=empty('Пока здесь тихо.','Добавь первую хотелку — посмотрим, сколько времени она задумала съесть.');
  else renderItemList($('itemsList'),items,state.profile,state.fx,unit,true);
  const total=summaryOfItems(items);$('totalCard').classList.toggle('hidden',n<2);
  if(n>=2){$('totalValue').textContent=Calc.smart(Calc.unitValue(total.hours,unit,state.profile),unit);$('totalMoney').textContent=Number.isFinite(total.money)?'≈ '+Calc.money(total.money,state.profile.currency):'';}
  updateFormButtons();updateWheelHelp();
}
async function addItem() {
  if(busy||!itemFormReady()||!state.profile)return;
  const item={id:S.uid('item'),name:$('itemName').value.trim(),price:num('itemPrice'),qty:num('itemQty'),currency:wheelValues.itemCurrency};
  dismissKeyboard();
  await magic('calculate',async()=>{
    if(item.currency!==state.profile.currency&&(!state.fx||state.fx.base!==state.profile.currency||!state.fx.rates?.[item.currency])) {
      let fx;try{fx=await fetchFx(state.profile.currency,true);}catch{return toast('Не удалось получить курс этой валюты. Поля сохранены — попробуй снова.');}
      if(!fx.rates[item.currency])return toast('Не удалось получить курс этой валюты.');
      const next=clone(state);next.fx=fx;if(!commit(next))return;
    }
    items.push(item);clearItemForm();renderCurrent();
    if(items.length!==2)toast(null,'itemAdded');
  });
}
function snapshot(){return K.card(items,state.profile,state.fx,unit,autoTitle(items));}
async function saveCalculation() {
  if(busy||savingCurrent||!items.length)return;
  savingCurrent=true;updateFormButtons();dismissKeyboard();
  try {
    let mode='together';
    if(items.length>1) mode=await dialog({title:'Что делаем с компанией?',text:'Сейчас здесь несколько хотелок. Они могут остаться вместе или начать самостоятельную жизнь.',actions:[
      {label:'Оставить одной карточкой',value:'together',primary:true},
      {label:'Собрать Большой план',value:'plan'},
      {label:'Разложить по карточкам',value:'separate'},
      {label:'Пока ничего',value:false}]});
    if(!mode)return;
    let title;
    if(mode==='plan'){title=await ask('Новый большой план','Как назовём то, что получилось?',autoTitle(items),'project');if(!title)return;}
    const next=clone(state);let createdPlan,createdCards=[];
    if(mode==='plan'){createdPlan=K.plan(items.map(it=>K.card([it],state.profile,state.fx,unit,it.name)),title,unit,false);next.projects.unshift(createdPlan);}
    else if(mode==='separate'){createdCards=items.map(it=>K.card([it],state.profile,state.fx,unit,it.name));next.calculations.unshift(...createdCards);}
    else {createdCards=[snapshot()];next.calculations.unshift(createdCards[0]);}
    if(!commit(next))return;
    const count=items.length;items=[];clearItemForm();renderAll();
    if(createdPlan){switchScreen('Projects');openProject(createdPlan.id);toast('Большой план собран. Серьёзные намерения зафиксированы.');}
    else if(mode==='separate')toast('Разложили по карточкам. Все '+count+' ждут в «Избранном».');
    else if(count>1)toast('Сохранили одной компанией. Ищи их в «Избранном».');
    else toast(null,'favoriteSaved');
  } finally {savingCurrent=false;updateFormButtons();}
}

function date(v){return new Date(v).toLocaleDateString('ru-RU')}
function empty(title,text){return `<div class="empty-state"><strong>${title}</strong>${text}</div>`}
function bindLongPress(card,id){U.hold(card,e=>{if(e.target.closest('.dots-button'))actionCalculation(find(state.calculations,id));else enterSelection(id);});}
function renderFavorites(){const list=K.sorted(activeCalcs(),state.sort.calculations),box=$('favoritesList');$('clearFavorites').classList.toggle('hidden',!list.length||selectionMode);box.classList.toggle('selection-mode',selectionMode);box.innerHTML='';if(!list.length){box.innerHTML=empty('Здесь пока ничего не припрятано.','Добавь карточку через «Хочу — могу?», и она появится здесь.');updateSelection();return}list.forEach(c=>{const s=Calc.calculationSummary(c),u=c.displayUnit||'hours',card=document.createElement('article');card.className='saved-card'+(selected.has(c.id)?' selected':selectionMode?' selection-muted':'');card.dataset.id=c.id;card.innerHTML=`<div class="saved-card-grid"><div><div class="saved-title"></div><div class="saved-meta">${date(c.createdAt)} · ${c.items.length} поз.</div><div class="saved-summary">${Calc.smart(Calc.unitValue(s.hours,u,c.profile),u)}</div></div><button class="dots-button" type="button" aria-label="Действия">${U.icon("more")}</button><div class="selection-mark">${selected.has(c.id)?'✓':''}</div></div>`;card.querySelector('.saved-title').textContent=c.title;card.onclick=e=>{if(card.dataset.held){delete card.dataset.held;return}if(e.target.closest('.dots-button'))return actionCalculation(c);selectionMode?toggleSelected(c.id):openFavorite(c.id)};bindLongPress(card,c.id);box.append(card)});updateSelection()}
function enterSelection(id){selectionMode=true;selected.add(id);renderFavorites();try{navigator.vibrate?.(8)}catch{}}
function toggleSelected(id){selected.has(id)?selected.delete(id):selected.add(id);if(!selected.size)selectionMode=false;renderFavorites()}
function updateSelection() {
  selected.forEach(id=>{if(!activeCalcs().some(c=>c.id===id))selected.delete(id);});
  const n=selected.size,on=currentScreen()==='Favorites'&&!openedFavorite&&selectionMode,canCombine=on&&n>=2;
  $('selectionBar').classList.toggle('hidden',!on);
  $('combineSelected').classList.toggle('hidden',!canCombine);
  $('selectionBarCount').textContent='Выбрано: '+n;
  $('selectionHint').classList.toggle('hidden',!on||n!==1);
  document.body.classList.toggle('selecting',on);
}
function exitSelection(){selectionMode=false;selected.clear();renderFavorites()}
function openFavorite(id,origin='Favorites') {
  const c=find(state.calculations,id);if(!c)return;
  favoriteOrigin=origin;openedFavorite=id;selectionMode=false;selected.clear();updateSelection();
  $('favoritesListView').classList.add('hidden');$('favoriteDetailView').classList.remove('hidden');
  selectWheel('favoriteUnit',c.displayUnit||'hours');renderFavoriteDetail();scrollTo({top:0});updateWheelHelp();
}
function closeFavorite(){$('favoriteDetailView').classList.add('hidden');$('favoritesListView').classList.remove('hidden');openedFavorite=null;renderFavorites()}
function renderFavoriteDetail(){const c=find(state.calculations,openedFavorite);if(!c)return;const u=c.displayUnit||'hours',s=Calc.calculationSummary(c);$('favoriteDetailTitle').textContent=c.title;$('favoriteDetailMeta').textContent=`${date(c.createdAt)} · ${c.items.length} поз.`;renderItemList($('favoriteDetailItems'),c.items,c.profile,c.fx,u);$('favoriteDetailTotalCard').classList.toggle('hidden',c.items.length<2);if(c.items.length>=2){$('favoriteDetailTotal').textContent=Calc.smart(Calc.unitValue(s.hours,u,c.profile),u);$('favoriteDetailMoney').textContent=Calc.money(s.money,c.profile.currency)}}

async function renameCalc(c){const name=await ask('Переименовать','Как теперь назвать эту карточку?',c.title);if(!name)return;c.title=name;c.updatedAt=stamp();state.projects.forEach(p=>p.calculations.filter(x=>x.sourceId===c.id).forEach(x=>x.title=name));if(!save())return;renderAll();toast(null,'renamed')}
async function editCalc(c, projectId=null) {
  const body=document.createElement('div');
  const title=labelledInput(body,'Название карточки',c.title,{maxLength:80});
  const list=document.createElement('div');list.className='editor-list';body.append(list);
  const editors=c.items.map(item=>{const el=document.createElement('fieldset');el.className='item-editor';const legend=document.createElement('legend');legend.textContent=item.name;el.append(legend);const editor=itemEditor(item,el);list.append(el);return editor;});
  const ok=await dialog({title:'Изменить детали',text:'Название, стоимость, валюта и количество. Исходный рабочий ритм сохраняется.',body,actions:[
    {label:'Отмена',value:false},{label:'Сохранить изменения',value:true,primary:true,enabled:()=>title.value.trim()&&editors.length&&editors.every(e=>e.valid())}]});
  if(!ok)return;
  const next=clone(state);
  const target=projectId?find(find(next.projects,projectId).calculations,c.id):find(next.calculations,c.id);
  target.title=title.value.trim();target.items=editors.map(e=>e.value());target.updatedAt=stamp();
  if(projectId)find(next.projects,projectId).updatedAt=stamp();
  else next.projects.forEach(p=>p.calculations.filter(x=>x.sourceId===c.id).forEach(x=>{x.title=target.title;x.items=clone(target.items);x.updatedAt=stamp();}));
  if(commit(next)){renderAll();toast(null,'edited');}
}
async function recalcCalc(c) {
  if(!await confirm('Пересчитать по текущему ритму?','Карточка будет пересчитана по твоим нынешним исходным данным. Её сохранённый результат будет заменён.','Пересчитать'))return;
  await magic('rhythm',async()=>{
    const next=clone(state),target=find(next.calculations,c.id);target.profile=clone(state.profile);
    if(target.fx?.base!==target.profile.currency) {
      try {target.fx=await fetchFx(target.profile.currency);}catch{
        if(target.items.some(it=>it.currency!==target.profile.currency)){toast('Не удалось получить свежий курс. Ничего не изменено.');return;}
        target.fx=null;
      }
    }
    target.updatedAt=stamp();if(commit(next)){renderAll();toast('Карточка пересчитана по текущему ритму.');}
  });
}
async function updateCalcFx(c) {
  if(!await confirm('Обновить курс этой карточки?','Мы возьмём актуальный курс валют и пересчитаем результат. Текущее значение будет заменено.','Обновить и пересчитать'))return;
  await magic('fx',async()=>{
    let fx;try{fx=await fetchFx(c.profile.currency,true);}catch{return toast('Не удалось получить свежий курс. Ничего не изменено.');}
    const next=clone(state),target=find(next.calculations,c.id);target.fx=fx;target.updatedAt=stamp();
    if(commit(next)){renderAll();toast('Курс обновлён. Карточка пересчитана.');}
  });
}
function archiveCalc(c){c.status='archived';c.archivedAt=stamp();c.updatedAt=stamp();if(!save())return;if(openedFavorite)closeFavorite();renderAll();toast(null,'archived')}
async function deleteCalc(c){const used=state.projects.some(p=>p.calculations.some(x=>x.sourceId===c.id)),text=used?'В «Избранном» карточка исчезнет, но останется внутри уже собранных «Больших планов».':'Она будет удалена с этого устройства. Вернуть её не получится.';if(!await confirm('Убрать карточку?',text,'Убрать'))return;state.calculations=state.calculations.filter(x=>x.id!==c.id);if(!save())return;if(openedFavorite)closeFavorite();renderAll();toast(null,'deleted')}
function actionCalculation(c){sheet(c.title,[{label:'Открыть',run:()=>openFavorite(c.id)},{label:'Выбрать',run:()=>enterSelection(c.id)},{label:'Переименовать',run:()=>renameCalc(c)},{label:'Изменить детали',run:()=>editCalc(c)},...(c.items.length>1?[{label:'Разделить карточку',run:()=>splitCard(c)}]:[]),{label:'Пересчитать по текущему ритму',run:()=>recalcCalc(c)},{label:'Обновить курс валют',run:()=>updateCalcFx(c)},{label:'Добавить в «Большой план»',run:()=>addOneToProject(c)},{label:'Переместить в Архив',run:()=>archiveCalc(c)},{label:'Удалить',danger:true,run:()=>deleteCalc(c)}])}

async function combine(){
  const chosen=activeCalcs().filter(c=>selected.has(c.id));if(chosen.length<2)return;
  const name=await ask('Новый большой план','Как назовём то, что получилось?','Новый большой план','project');if(!name)return;
  const project={id:S.uid('project'),createdAt:stamp(),updatedAt:stamp(),archivedAt:null,status:'active',type:'project',title:name,displayUnit:'hours',calculations:chosen.map(c=>({...clone(c),id:S.uid('pc'),sourceId:c.id,status:'favorite'}))};
  const next=clone(state);next.projects.unshift(project);
  if(!commit(next))return;
  exitSelection();renderAll();toast(null,'projectSaved');
}
async function addOneToProject(c){const projects=activeProjects();if(!projects.length)return toast('Сначала собери большой план минимум из двух карточек.');sheet('Выбери большой план',projects.map(p=>({label:p.title,run:()=>{if(p.calculations.some(x=>x.sourceId===c.id))return toast('Эта карточка уже есть в выбранном плане.');p.calculations.push({...clone(c),id:S.uid('pc'),sourceId:c.id});p.updatedAt=stamp();if(!save())return;renderAll();toast('Карточка добавлена в «Большой план».')}})))}
function renderProjects(){const list=K.sorted(activeProjects(),state.sort.projects,true),box=$('projectsList');$('clearProjects').classList.toggle('hidden',!list.length);box.innerHTML='';if(!list.length){box.innerHTML=empty('Больших планов пока нет.','Выбери минимум две карточки в «Избранном» или собери план прямо из текущих хотелок.');return}list.forEach(p=>{const s=Calc.projectSummary(p),first=p.calculations[0]?.profile||state.profile,u=p.displayUnit||'hours',card=document.createElement('article');card.className='project-card';card.innerHTML=`<div class="saved-card-grid"><div><div class="saved-title"></div><div class="saved-meta">${date(p.createdAt)} · ${p.calculations.length} карточек</div><div class="saved-summary">${first?Calc.smart(projectTime(p,u),u):'—'}</div></div><button class="dots-button" type="button">${U.icon("more")}</button></div>`;card.querySelector('.saved-title').textContent=p.title;card.onclick=e=>e.target.closest('.dots-button')?actionProject(p):openProject(p.id);box.append(card)})}
function openProject(id,origin='Projects') {
  const p=find(state.projects,id);if(!p)return;
  projectOrigin=origin;openedProject=id;$('projectsListView').classList.add('hidden');$('projectDetailView').classList.remove('hidden');
  selectWheel('projectUnit',p.displayUnit||'hours');renderProjectDetail();scrollTo({top:0});updateWheelHelp();
}
function closeProject(){$('projectDetailView').classList.add('hidden');$('projectsListView').classList.remove('hidden');openedProject=null;renderProjects()}
function renderProjectDetail(){const p=find(state.projects,openedProject);if(!p)return;const u=p.displayUnit||'hours',s=Calc.projectSummary(p),first=p.calculations[0]?.profile||state.profile;$('projectDetailTitle').textContent=p.title;$('projectDetailMeta').textContent=`${date(p.createdAt)} · ${p.calculations.length} карточек`;$('projectDetailGroups').innerHTML='';p.calculations.forEach(c=>{const cs=Calc.calculationSummary(c),g=document.createElement('div');g.className='group-card';g.innerHTML=`<div class="group-title"></div><div class="item-meta"></div><div class="group-total">${Calc.smart(Calc.unitValue(cs.hours,u,c.profile),u)}</div>`;g.querySelector('.group-title').textContent=c.title;g.querySelector('.item-meta').textContent=c.items.map(x=>x.name).join(' · ');const edit=document.createElement('button');edit.type='button';edit.className='dots-button';edit.setAttribute('aria-label','Действия: '+c.title);edit.innerHTML=U.icon('more');edit.onclick=()=>sheet(c.title,[{label:'Изменить детали',run:()=>editCalc(c,p.id)}]);g.append(edit);$('projectDetailGroups').append(g)});$('projectDetailTotalCard').classList.toggle('hidden',p.calculations.length<2);if(p.calculations.length>=2){$('projectDetailTotal').textContent=Calc.smart(projectTime(p,u),u);const same=p.calculations.every(c=>c.profile?.currency===first.currency);$('projectDetailMoney').textContent=same?Calc.money(s.money,first.currency):''}}
async function renameProject(p){const n=await ask('Переименовать','Как теперь назвать этот большой план?',p.title,'project');if(!n)return;p.title=n;p.updatedAt=stamp();if(!save())return;renderAll();toast(null,'renamed')}
async function rebuildProject(p) {
  const body=document.createElement('div');body.className='picker-list';
  const choices=p.calculations.map(c=>({key:c.id,card:c,existing:true}));
  activeCalcs().filter(c=>!p.calculations.some(pc=>pc.sourceId===c.id)).forEach(c=>choices.push({key:c.id,card:c,existing:false}));
  const ids=new Set(p.calculations.map(c=>c.id));
  choices.forEach(choice=>{
    const label=document.createElement('label');label.className='picker-option';
    const check=document.createElement('input');check.type='checkbox';check.checked=choice.existing;
    check.onchange=()=>check.checked?ids.add(choice.key):ids.delete(choice.key);
    const span=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');
    title.textContent=choice.card.title;meta.textContent=choice.existing?'Уже в этом плане':'Из «Избранного»';span.append(title,meta);label.append(check,span);body.append(label);
  });
  const ok=await dialog({title:'Пересобрать план',text:'Оставь минимум две карточки. Собственные части плана тоже здесь — они не потеряются.',body,actions:[
    {label:'Отмена',value:false},{label:'Сохранить состав',value:true,primary:true,enabled:()=>ids.size>=2}]});
  if(!ok)return;
  const next=clone(state),target=find(next.projects,p.id);
  target.calculations=choices.filter(x=>ids.has(x.key)).map(x=>x.existing?clone(x.card):{...clone(x.card),id:S.uid('pc'),sourceId:x.card.id});
  target.updatedAt=stamp();if(commit(next)){renderAll();toast('«Большой план» обновлён.');}
}
async function updateProjectFx(p) {
  if(!await confirm('Обновить курсы всего плана?','Все позиции внутри этого плана будут пересчитаны по актуальным курсам валют. Результат может как увеличиться, так и уменьшиться.','Обновить весь план'))return;
  await magic('fx',async()=>{
    const cache={};
    try {for(const base of new Set(p.calculations.map(c=>c.profile.currency)))cache[base]=await fetchFx(base,true);}
    catch{return toast('Не удалось обновить курсы. Ничего не изменено.');}
    const next=clone(state),target=find(next.projects,p.id);
    target.calculations.forEach(c=>{c.fx=clone(cache[c.profile.currency]);c.updatedAt=stamp();});target.updatedAt=stamp();
    if(commit(next)){renderAll();toast('Курсы обновлены. «Большой план» снова в настоящем.');}
  });
}
async function recalcProject(p) {
  if(!await confirm('Пересчитать весь план по текущему ритму?','Все позиции этого плана будут пересчитаны по нынешнему рабочему ритму. Другие планы и карточки не изменятся.','Пересчитать'))return;
  await magic('rhythm',async()=>{
    let fx=state.fx?.base===state.profile.currency?clone(state.fx):null;
    if(!fx&&p.calculations.some(c=>c.items.some(it=>it.currency!==state.profile.currency))){
      try{fx=await fetchFx(state.profile.currency);}catch{return toast('Не удалось получить свежий курс. Ничего не изменено.');}
    }
    const next=clone(state),target=find(next.projects,p.id);
    target.calculations.forEach(c=>{c.profile=clone(state.profile);c.fx=fx?clone(fx):null;c.updatedAt=stamp();});
    target.updatedAt=stamp();if(commit(next)){renderAll();toast('«Большой план» пересчитан по текущему ритму.');}
  });
}
function archiveProject(p){p.status='archived';p.archivedAt=stamp();if(!save())return;if(openedProject)closeProject();renderAll();toast(null,'archived')}
async function deleteProject(p){if(!await confirm('Удалить большой план?','План и его собственные позиции исчезнут. Карточки, которые отдельно сохранены в «Избранном», останутся там.','Удалить'))return;state.projects=state.projects.filter(x=>x.id!==p.id);if(!save())return;if(openedProject)closeProject();renderAll();toast(null,'deleted')}
function actionProject(p){sheet(p.title,[{label:'Открыть',run:()=>openProject(p.id)},{label:'Переименовать',run:()=>renameProject(p)},{label:'Пересобрать план',run:()=>rebuildProject(p)},{label:'Пересчитать по текущему ритму',run:()=>recalcProject(p)},{label:'Обновить курсы плана',run:()=>updateProjectFx(p)},{label:'Переместить в Архив',run:()=>archiveProject(p)},{label:'Удалить',danger:true,run:()=>deleteProject(p)}])}

function renderArchive(){document.querySelectorAll('[data-archive-tab]').forEach(b=>b.classList.toggle('active',b.dataset.archiveTab===archiveTab));const box=$('archiveList'),list=archiveTab==='calculations'?state.calculations.filter(x=>x.status==='archived'):state.projects.filter(x=>x.status==='archived');box.innerHTML='';if(!list.length){box.innerHTML=empty('В Архиве пока пусто.','Здесь будут отдыхать карточки и планы, которые ты решил не удалять.');return}list.forEach(x=>{const card=document.createElement('article');card.className='archive-card';card.innerHTML=`<div class="saved-card-grid"><div><div class="saved-title"></div><div class="saved-meta">В Архиве с ${date(x.archivedAt||x.updatedAt)}</div></div><button class="dots-button" type="button">${U.icon("more")}</button></div>`;card.querySelector('.saved-title').textContent=x.title;card.onclick=e=>{if(e.target.closest('.dots-button'))return archiveActions(x,archiveTab);switchScreen(archiveTab==='calculations'?'Favorites':'Projects');archiveTab==='calculations'?openFavorite(x.id,'Archive'):openProject(x.id,'Archive');};U.hold(card,()=>archiveActions(x,archiveTab));box.append(card)})}
function archiveActions(x,type) {
  const isCalc=type==='calculations';
  sheet(x.title,[
    {label:'Открыть',run:()=>{switchScreen(isCalc?'Favorites':'Projects');isCalc?openFavorite(x.id,'Archive'):openProject(x.id,'Archive');}},
    {label:isCalc?'Вернуть в «Избранное»':'Вернуть в «Большие планы»',run:()=>{
      const next=clone(state),target=find(next[type],x.id);target.status=isCalc?'favorite':'active';target.archivedAt=null;target.updatedAt=stamp();
      if(commit(next)){switchScreen('Archive');renderAll();toast('Вернули. '+(isCalc?'Карточка в «Избранном».':'План в «Больших планах».'));}
    }},
    {label:isCalc?'Обновить курс валют':'Обновить курсы плана',run:()=>isCalc?updateCalcFx(x):updateProjectFx(x)},
    {label:'Удалить навсегда',danger:true,run:async()=>{
      if(!await confirm('Удалить навсегда?','Вернуть этот элемент после удаления не получится.','Удалить'))return;
      const next=clone(state);next[type]=next[type].filter(v=>v.id!==x.id);if(commit(next)){switchScreen('Archive');renderAll();toast('Удалено.');}
    }}
  ]);
}
function openArchive(tab='calculations'){previousScreen=currentScreen();archiveTab=tab;switchScreen('Archive')}

function faq(){const device=/iPhone/i.test(navigator.userAgent)?'этом iPhone':'этом устройстве';const data=[['Что вообще происходит?','My Rate переводит стоимость вещей и планов в твоё рабочее время. Ты задаёшь отправную сумму и привычный рабочий ритм, а остальная математика происходит за кулисами. Это не финансовый прогноз — это другой способ посмотреть на ценник.'],['Почему мне не показывают стоимость моего часа?','Потому что мы намеренно не выставляем промежуточную формулу напоказ. Ты видишь итог, а математика спокойно делает свою работу за сценой.'],['Как считается время?','Мы учитываем выбранный период, количество рабочих дней в неделе и часов в рабочем дне. В году используется 52 рабочие недели, а месяц считается как средняя часть года.'],['Насколько точен результат?','Результат приблизительный. Реальная стоимость времени зависит от отпусков, премий, переработок и других обстоятельств. My Rate предлагает точку зрения, а не абсолютную истину.'],['Куда уходят мои данные?',`Сумма, карточки и планы сохраняются на ${device}. Поиск выполняется на устройстве. Для получения курса приложение обращается к валютному сервису без сумм и названий. Как при любом интернет-запросе, сервис получает технические сведения о соединении. Если удалить данные сайта с устройства, «Избранное» и «Большие планы» тоже исчезнут.`],['Откуда берутся курсы валют?','Используются информационные курсы Exchange Rate API. Они обновляются приблизительно раз в сутки. Сохранённая карточка запоминает курс, использованный при создании.'],['«Избранное» и «Большие планы» — в чём разница?','«Избранное» хранит отдельные карточки. «Большой план» объединяет несколько карточек и показывает их вместе. Общий итог появляется минимум для двух позиций.'],['Как изменить карточку?','Нажми на три точки: «Переименовать» меняет название, «Изменить детали» — цену, количество и валюту. В текущем списке детали меняются так же. Долгое нажатие на сохранённую карточку включает выбор, на её три точки — открывает меню.'],['Как сохранить несколько хотелок?','Нажми «Куда это всё?»: можно оставить позиции одной карточкой, разложить по отдельным карточкам в «Избранном» или собрать Большой план без добавления в «Избранное».'],['Как разделить карточку?','В меню карточки с несколькими позициями есть «Разделить карточку». Можно создать отдельные копии или заменить общую карточку. Уже собранные планы не изменятся.'],['Как работает поиск?','Лупа ищет названия карточек, позиций и планов, в том числе в Архиве. Поисковый запрос остаётся на устройстве.'],['Что умеет нижняя панель?','Нажми на раздел или веди палец вдоль панели и отпусти над нужным. Долгое нажатие без движения открывает действия раздела. Те же действия есть в кнопке «Действия» над списком.'],['Почему барабан не крутится сразу?','Так он не мешает прокручивать страницу. Быстро проведи пальцем — страница продолжит движение. Немного задержи палец, дождись подсветки и потяни — начнёт вращаться барабан.'],['Можно убрать анимацию и реплики?','Да. В настройках можно отдельно отключить «Магию пересчёта» и «Шутки и реплики». Расчёты продолжат работать.'],['Кто всё это устроил?','My Rate — первый продукт PROBA. Небольшой эксперимент о том, как переводить желания из денег в собственное время. Designed & created by PROBA.'],['Что будет дальше?','Есть мысль однажды перевести время в социальных сетях в минуты, дни и даже годы. Пока это только намёк.']];$('faqContent').innerHTML='';data.forEach(([q,a])=>{const d=document.createElement('details');d.className='faq-item';d.innerHTML='<summary></summary><div class="faq-answer"></div>';d.querySelector('summary').textContent=q;d.querySelector('.faq-answer').textContent=a;$('faqContent').append(d)})}
function projectTime(p,u){return p.calculations.reduce((sum,c)=>sum+Calc.unitValue(Calc.calculationSummary(c).hours,u,c.profile),0);}
function currentScreen(){return document.querySelector('.screen.active')?.id.replace('screen','')||'Current'}
function switchScreen(name) {
  if(!$('screen'+name))return;
  closeHelp();closeSheet();dismissKeyboard();
  const changed=currentScreen()!==name;
  if(changed){selectionMode=false;selected.clear();}
  document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='screen'+name));
  if(name==='Favorites'){closeFavorite();renderFavorites();}
  if(name==='Projects'){closeProject();renderProjects();}
  if(name==='Archive')renderArchive();
  if(name==='Faq')faq();
  if(name==='Current')renderProfileStage();
  $('bottomNav').classList.toggle('hidden',!Calc.isValidProfile(state.profile||{})||setupOpen&&name==='Current'||['Archive','Settings','Faq'].includes(name));
  $('appFooter').classList.toggle('hidden',['Archive','Settings','Faq'].includes(name));
  updateSelection();navControl?.sync();updateWheelHelp();scrollTo({top:0,behavior:'instant'});
}
function renderAll() {
  renderCurrent();renderFavorites();renderProjects();
  if(currentScreen()==='Archive')renderArchive();
  if(openedFavorite)renderFavoriteDetail();if(openedProject)renderProjectDetail();
  $('magicToggle').checked=state.settings.magic;$('jokesToggle').checked=state.settings.jokes;
  updateFormButtons();U.icons();
}

async function updateAllFx() {
  const mode=await dialog({title:'Обновить все курсы?',text:'Текущий список, карточки в «Избранном» и активные Большие планы будут пересчитаны по свежим курсам. Архив — только если ты выберешь его ниже.',actions:[
    {label:'Не надо',value:false},{label:'Только активное',value:'active',primary:true},{label:'Включая Архив',value:'all'}]});
  if(!mode)return;
  await magic('fx',async()=>{
    const next=clone(state),projects=next.projects.filter(x=>mode==='all'||x.status!=='archived');
    const cards=[...next.calculations.filter(x=>mode==='all'||x.status!=='archived'),...projects.flatMap(p=>p.calculations)];
    const bases=new Set([next.profile?.currency,...cards.map(c=>c.profile?.currency)].filter(Boolean)),cache={};
    try{for(const base of bases)cache[base]=await fetchFx(base,true);}catch{return toast('Не удалось обновить курсы. Ничего не изменено.');}
    cards.forEach(c=>{c.fx=clone(cache[c.profile.currency]);c.updatedAt=stamp();});
    projects.forEach(p=>p.updatedAt=stamp());if(next.profile)next.fx=clone(cache[next.profile.currency]);
    if(commit(next)){renderAll();if(next.fx)$('fxStatus').textContent='Курсы валют: '+date(next.fx.updated*1000);toast('Всё выбранное пересчитано по свежим курсам.');}
  });
}


/* 3.0 — onboarding, editable draft items, collection tools and local search. */
function labelledInput(parent,label,value='',options={}) {
  const block=document.createElement('div');block.className='field-block';
  const row=document.createElement('div');row.className='label-row';
  const id=S.uid('field'),name=document.createElement('label');name.htmlFor=id;name.textContent=label;row.append(name);
  if(options.help){const b=document.createElement('button');b.type='button';b.className='help-button';b.dataset.help=options.help;b.textContent='?';b.setAttribute('aria-label','Подсказка: '+label);row.append(b);}
  const input=document.createElement('input');input.id=id;input.value=value;input.required=true;input.setAttribute('aria-required','true');
  input.autocomplete='off';input.placeholder=options.placeholder||label;
  if(options.maxLength)input.maxLength=options.maxLength;
  if(options.number){input.inputMode='decimal';input.dataset.min=options.min;input.dataset.max=options.max;input.oninput=()=>sanitize(input);}
  block.append(row,input);parent.append(block);return input;
}
function itemEditor(item,parent) {
  const name=labelledInput(parent,'Название',item.name,{maxLength:80,help:'itemName'});
  const price=labelledInput(parent,'Цена одной штуки',item.price,{number:true,min:.01,max:1e15,help:'itemPrice'});
  const block=document.createElement('div');block.className='field-block';
  const label=document.createElement('label'),currency=document.createElement('select');
  currency.id=S.uid('currency');label.htmlFor=currency.id;label.textContent='Валюта';
  Object.entries(C.currencies).forEach(([value,text])=>currency.add(new Option(text,value)));currency.value=item.currency;
  block.append(label,currency);parent.append(block);
  const qty=labelledInput(parent,'Количество',item.qty,{number:true,min:.01,max:1e6,help:'quantity',placeholder:'1'});
  return {valid:()=>Boolean(name.value.trim()&&validNumber(price)&&validNumber(qty)&&C.currencies[currency.value]),
    value:()=>({...item,name:name.value.trim(),price:Number(price.value),qty:Number(qty.value),currency:currency.value})};
}
function clearItemForm() {
  ['itemName','itemPrice','itemQty'].forEach(id=>{$(id).value='';clearFieldError($(id));});
  updateFormButtons();
}
function currentItemMenu(id) {
  const item=find(items,id);if(!item)return;
  sheet(item.name,[
    {label:'Изменить детали',run:()=>editCurrentItem(id)},
    {label:'Сделать копию',run:()=>{items.push({...clone(item),id:S.uid('item')});renderCurrent();toast(null,'currentCopied');}},
    {label:'Убрать из текущего',run:()=>{items=items.filter(it=>it.id!==id);renderCurrent();toast(null,'currentRemoved');}}
  ]);
}
async function editCurrentItem(id) {
  const item=find(items,id);if(!item)return;
  const body=document.createElement('div');body.className='item-editor';const editor=itemEditor(item,body);
  const ok=await dialog({title:'Подкрутим хотелку',body,actions:[
    {label:'Не менять',value:false},{label:'Сохранить изменения',value:true,primary:true,enabled:editor.valid}]});
  if(!ok)return;
  items=items.map(it=>it.id===id?editor.value():it);renderCurrent();toast(null,'currentEdited');
}
function renderProfileStage() {
  const ready=Calc.isValidProfile(state.profile||{});
  $('welcome').classList.toggle('hidden',ready||setupOpen);
  $('profileEditor').classList.toggle('hidden',!setupOpen);
  $('converter').classList.toggle('hidden',!ready||setupOpen);
  $('quickProfile').classList.toggle('hidden',!ready||setupOpen);
  $('profilePrivacy').textContent=privacy();
  $('profileBack').textContent=ready?'Не менять':'← Назад';
  if(currentScreen()==='Current')$('bottomNav').classList.toggle('hidden',!ready||setupOpen);
  updateWheelHelp();navControl?.sync();
}
function editProfileFrom(origin=currentScreen()) {
  profileReturn=origin;setupOpen=true;fillProfile(state.profile);
  switchScreen('Current');renderProfileStage();
}
function updateWheelHelp() {
  const roots=[...document.querySelectorAll('.wheel')];
  let shown=false;
  roots.forEach(root=>{
    let note=root.parentElement.querySelector('.wheel-help');
    if(!note){note=document.createElement('div');note.className='wheel-help';note.id=S.uid('wheelHint');note.innerHTML=U.icon('arrows')+'<span><strong>Это барабан</strong>Зажми его на мгновение и веди вверх или вниз.</span>';root.after(note);root.setAttribute('aria-describedby',note.id);}
    const visible=!root.closest('.hidden')&&!root.closest('.screen:not(.active)');
    const show=visible&&!shown&&!state.onboarding.wheelLearned;
    note.classList.toggle('hidden',!show);
    if(show){
      shown=true;
      if(!root.dataset.demonstrated){root.dataset.demonstrated='1';root.classList.add('is-demonstrating');setTimeout(()=>root.classList.remove('is-demonstrating'),1500);}
    }
    if(state.onboarding.wheelLearned)root.removeAttribute('aria-describedby');
  });
}
function learnedWheel() {
  if(state.onboarding.wheelLearned)return;
  const next=clone(state);next.onboarding.wheelLearned=true;
  if(commit(next))updateWheelHelp();
}
async function splitCard(c) {
  if(c.items.length<2)return;
  const mode=await dialog({title:'Каждому по карточке?',text:'Будет создано: '+c.items.length+' карточек. Можно заменить общую карточку отдельными или создать копии, ничего не удаляя. Уже собранные Большие планы не изменятся.',actions:[
    {label:'Создать отдельные копии',value:'copy',primary:true},
    {label:'Разделить и заменить',value:'replace'},
    {label:'Не разделять',value:false}]});
  if(!mode)return;
  const next=clone(state),cards=K.split(c);
  if(mode==='replace')next.calculations=next.calculations.filter(x=>x.id!==c.id);
  next.calculations.unshift(...cards);
  if(commit(next)){exitSelection();closeFavorite();renderAll();toast('Готово. В «Избранном» теперь отдельных карточек: '+cards.length+'.');}
}
function sortMenu(type) {
  sheet('Разложить по полочкам',Object.entries({new:'Сначала новые',old:'Сначала старые',name:'По алфавиту',timeAsc:'Меньше рабочего времени',timeDesc:'Больше рабочего времени'}).map(([value,label])=>({
    label:(state.sort[type]===value?'✓ ':'')+label,run:()=>{const next=clone(state);next.sort[type]=value;if(commit(next))renderAll();}
  })));
}
async function refreshScope(type) {
  const project=type==='projects',targets=project?activeProjects():activeCalcs();
  if(!targets.length)return;
  if(!await confirm('Освежить все курсы?',project?'Все активные Большие планы пересчитаются по новым курсам. «Избранное» и Архив не изменятся.':'Все карточки в «Избранном» пересчитаются по новым курсам. Большие планы и Архив не изменятся.','Обновить и пересчитать'))return;
  await magic('fx',async()=>{
    const next=clone(state),list=next[type].filter(x=>x.status!=='archived'),cards=project?list.flatMap(p=>p.calculations):list;
    const cache={};
    try {for(const base of new Set(cards.map(c=>c.profile.currency)))cache[base]=await fetchFx(base,true);}
    catch {toast('Не удалось обновить курсы. Ничего не изменено.');return;}
    cards.forEach(c=>{c.fx=clone(cache[c.profile.currency]);c.updatedAt=stamp();});
    list.forEach(x=>x.updatedAt=stamp());
    if(commit(next)){renderAll();toast('Всё выбранное пересчитано по свежим курсам.');}
  });
}
function sectionMenu(name) {
  if(name==='Current') {
    sheet('Хочу — могу?',[
      {label:'Подкрутить мой ритм',run:()=>editProfileFrom()},
      items.length?{label:'Очистить текущий список',run:()=>$('clearItems').click()}:null,
      {label:'Что здесь происходит?',run:()=>{previousScreen=currentScreen();switchScreen('Faq');}}
    ]);return;
  }
  const favorite=name==='Favorites',list=favorite?activeCalcs():activeProjects(),type=favorite?'calculations':'projects';
  sheet(favorite?'Избранное':'Большие планы',[
    favorite&&list.length>=2?{label:'Собрать Большой план',run:()=>{switchScreen('Favorites');selectionMode=true;renderFavorites();}}:null,
    list.length>1?{label:'Разложить по полочкам',run:()=>sortMenu(type)}:null,
    list.length?{label:'Освежить все курсы',run:()=>refreshScope(type)}:null,
    {label:'Заглянуть в Архив',run:()=>openArchive(type)},
    list.length?{label:favorite?'Удалить всё':'Удалить все планы',danger:true,run:()=>$(favorite?'clearFavorites':'clearProjects').click()}:null
  ]);
}
function openSearch() {
  if(searchRelease)return;
  closeSheet();closeHelp();searchScroll=window.scrollY;
  const layer=$('searchLayer');layer.classList.remove('hidden');document.body.classList.add('search-open');
  searchRelease=U.focusLayer(layer,closeSearch);
  $('searchPrivacy').textContent='Ищем в «Избранном», Больших планах и Архиве. Только на '+(/iPhone/i.test(navigator.userAgent)?'этом iPhone.':'этом устройстве.');
  renderSearch();$('searchInput').focus({preventScroll:true});
}
function closeSearch() {
  if(!searchRelease)return;
  dismissKeyboard();$('searchLayer').classList.add('hidden');document.body.classList.remove('search-open');
  const release=searchRelease;searchRelease=null;release();scrollTo({top:searchScroll,behavior:'instant'});
}
function renderSearch() {
  const query=$('searchInput').value,results=K.search(state,query,searchScope),box=$('searchResults');box.replaceChildren();
  document.querySelectorAll('[data-search-filter]').forEach(b=>{const active=b.dataset.searchFilter===searchScope;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('searchStatus').textContent=query.trim().length<2?'Напиши хотя бы пару букв. Телепатия пока в следующем патче.':results.length?'Найдено: '+results.length:'Ничего не нашли. Возможно, хотелка хорошо спряталась.';
  for(const [group,label] of Object.entries({favorites:'Избранное',projects:'Большие планы',archive:'Архив'})){
    const matches=results.filter(x=>x.group===group);if(!matches.length)continue;
    const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=label;section.append(heading);
    matches.forEach(result=>{
      const button=document.createElement('button');button.className='search-result';button.type='button';
      const title=document.createElement('strong'),meta=document.createElement('span');title.textContent=result.title;
      meta.textContent=(result.type==='projects'?'Большой план · ':'Карточка · ')+result.description;button.append(title,meta);
      button.onclick=()=>{closeSearch();const isCalc=result.type==='calculations';switchScreen(isCalc?'Favorites':'Projects');const origin=result.group==='archive'?'Archive':isCalc?'Favorites':'Projects';
        if(origin==='Archive')archiveTab=result.type;
        isCalc?openFavorite(result.id,origin):openProject(result.id,origin);
      };section.append(button);
    });box.append(section);
  }
}
function setupExperience() {
  U.icons();
  document.addEventListener('contextmenu',e=>{if(!e.target.closest('input,textarea,select'))e.preventDefault();});
  $('startSetup').onclick=()=>{setupOpen=true;renderProfileStage();scrollTo({top:0});};
  setupStories();
  setupMeaning();
  $('quickProfile').onclick=()=>editProfileFrom('Current');
  $('profileBack').onclick=()=>{setupOpen=false;fillProfile(state.profile);renderProfileStage();switchScreen(profileReturn);};
  $('editProfile').onclick=()=>editProfileFrom('Settings');
  document.querySelectorAll('[data-section-menu]').forEach(b=>b.onclick=()=>sectionMenu(b.dataset.sectionMenu));
  $('searchButton').onclick=openSearch;$('closeSearch').onclick=closeSearch;
  $('searchInput').oninput=renderSearch;
  $('searchLayer').onclick=e=>{if(e.target===$('searchLayer'))closeSearch();};
  document.querySelectorAll('[data-search-filter]').forEach(b=>b.onclick=()=>{searchScope=b.dataset.searchFilter;renderSearch();});
  navControl=U.navigation($('navCapsule'),$('navIndicator'),name=>switchScreen(name),sectionMenu,currentScreen);
  $('favoriteBack').onclick=()=>{if(favoriteOrigin==='Archive')switchScreen('Archive');else closeFavorite();};
  $('projectBack').onclick=()=>{if(projectOrigin==='Archive')switchScreen('Archive');else closeProject();};
  $('favoriteDetailMenu').onclick=()=>{const c=find(state.calculations,openedFavorite);if(c)c.status==='archived'?archiveActions(c,'calculations'):actionCalculation(c);};
  $('projectDetailMenu').onclick=()=>{const p=find(state.projects,openedProject);if(p)p.status==='archived'?archiveActions(p,'projects'):actionProject(p);};
  // Match the visual viewport when the on-screen keyboard reduces the usable height.
  const revealFocused=()=>{
    const active=document.activeElement;
    if(!active?.matches?.('input, textarea, select'))return;
    requestAnimationFrame(()=>active.scrollIntoView?.({block:'center',inline:'nearest',behavior:'smooth'}));
  };
  const viewport=()=>{
    const v=window.visualViewport;
    document.documentElement.style.setProperty('--visible-height',(v?.height||innerHeight)+'px');
    document.documentElement.style.setProperty('--visible-top',(v?.offsetTop||0)+'px');
    document.documentElement.style.setProperty('--visible-width',(v?.width||innerWidth)+'px');
    document.documentElement.style.setProperty('--visible-left',(v?.offsetLeft||0)+'px');
    clearTimeout(viewport.focusTimer);viewport.focusTimer=setTimeout(revealFocused,90);
  };
  window.visualViewport?.addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('scroll',viewport);addEventListener('resize',viewport);
  document.addEventListener('focusin',()=>{setTimeout(revealFocused,90);setTimeout(revealFocused,320);});
  viewport();
}

document.querySelectorAll('[data-number]').forEach(i=>{i.addEventListener('input',()=>sanitize(i));i.addEventListener('paste',()=>setTimeout(()=>sanitize(i)))});
document.addEventListener('input',e=>{if(e.target.matches?.('input, textarea, select')){e.target.classList.remove('field-error');e.target.removeAttribute('aria-invalid');updateFormButtons();}});
document.addEventListener('click',e=>{const help=e.target.closest('[data-help]');if(help){e.stopPropagation();showHelp(help);return}if(!e.target.closest('#helpPopover'))closeHelp();const arch=e.target.closest('[data-open-archive]');if(arch)openArchive(arch.dataset.openArchive)});
document.addEventListener('focusin',e=>{if(e.target.matches('input, textarea, select')){closeHelp();document.body.classList.add('keyboard-open')}});document.addEventListener('focusout',()=>setTimeout(()=>{if(!document.activeElement?.matches?.('input, textarea, select'))document.body.classList.remove('keyboard-open')},120));addEventListener('scroll',closeHelp,{passive:true});
$('saveProfile').onclick=saveProfile;$('addItem').onclick=addItem;$('clearItems').onclick=async()=>{if(await confirm('Очистить всё на этом экране?','Текущие позиции исчезнут. Настройки твоего рабочего ритма останутся на месте.','Очистить')){items=[];renderCurrent()}};$('saveCalculation').onclick=saveCalculation;
$('cancelSelection').onclick=exitSelection;$('combineSelected').onclick=combine;$('clearFavorites').onclick=async()=>{const a=activeCalcs();if(!a.length)return;if(await confirm('Очистить всё «Избранное»?','Все карточки исчезнут из «Избранного». То, что уже входит в «Большие планы», останется внутри них.','Очистить')){state.calculations=state.calculations.filter(x=>x.status==='archived');if(!save())return;renderAll();toast(null,'deleted')}};
$('clearProjects').onclick=async()=>{const a=activeProjects();if(!a.length)return;if(await confirm('Удалить все большие планы?','Активные планы будут удалены. Карточки в «Избранном» и содержимое Архива останутся на месте.','Удалить всё')){state.projects=state.projects.filter(x=>x.status==='archived');if(!save())return;renderAll();toast(null,'deleted')}};
$('archiveBack').onclick=()=>switchScreen(previousScreen);document.querySelectorAll('[data-archive-tab]').forEach(b=>b.onclick=()=>{archiveTab=b.dataset.archiveTab;renderArchive()});
{const gear=$('settingsButton'),leaveSettings=()=>switchScreen(previousScreen&&previousScreen!=='Settings'?previousScreen:'Current');let hold,x,y;gear.onpointerdown=e=>{x=e.clientX;y=e.clientY;hold=setTimeout(()=>{gear.dataset.held='1';sheet('Быстрые настройки',[{label:'Подкрутить мой рабочий ритм',run:()=>{$('editProfile').click()}},{label:state.settings.magic?'Убрать магию пересчёта':'Вернуть магию пересчёта',run:()=>{state.settings.magic=!state.settings.magic;if(!save())return;renderAll()}},{label:state.settings.jokes?'Убавить разговорчивость':'Вернуть шутки и реплики',run:()=>{state.settings.jokes=!state.settings.jokes;if(!save())return;renderAll()}},{label:'Что за магия?',run:()=>{previousScreen=currentScreen();switchScreen('Faq')}}])},C.cardHoldMs)};gear.onpointermove=e=>{if(Math.abs(e.clientX-x)>8||Math.abs(e.clientY-y)>8)clearTimeout(hold)};gear.onpointerup=gear.onpointercancel=()=>clearTimeout(hold);gear.onclick=()=>{if(gear.dataset.held){delete gear.dataset.held;return}if(currentScreen()==='Settings'){leaveSettings();return}previousScreen=currentScreen();switchScreen('Settings')};$('settingsBack').onclick=leaveSettings;}
$('openFaq').onclick=()=>{previousScreen='Settings';switchScreen('Faq')};$('faqBack').onclick=()=>switchScreen(previousScreen);
$('magicToggle').onchange=e=>{state.settings.magic=e.target.checked;save()};$('jokesToggle').onchange=e=>{state.settings.jokes=e.target.checked;save()};$('updateAllFx').onclick=updateAllFx;

wheelValues.unit=unit;wheelValues.favoriteUnit='hours';wheelValues.projectUnit='hours';setupWheel('incomeCurrency',C.currencies);setupWheel('itemCurrency',C.currencies);setupWheel('period',C.periods);setupWheel('unit',C.units,v=>magic('calculate',()=>{unit=v;renderCurrent()}));setupWheel('favoriteUnit',C.units,v=>{const c=find(state.calculations,openedFavorite);if(c){magic('calculate',()=>{c.displayUnit=v;if(!save())return;renderFavoriteDetail()})}});setupWheel('projectUnit',C.units,v=>{const p=find(state.projects,openedProject);if(p){magic('calculate',()=>{p.displayUnit=v;if(!save())return;renderProjectDetail()})}});
setupExperience();
if(Calc.isValidProfile(state.profile||{})){
  fillProfile(state.profile);selectWheel('itemCurrency',state.profile.currency);
  ensureCurrentFx(false).then(renderAll);
}
renderProfileStage();renderAll();
setupIntroLifecycle();
runIntro('launch');
window.MyRateReady=true;
if(S.warning)setTimeout(()=>toast(S.warning),6500);

/* A gentle repeating hint on every visit to a long, unscrolled screen; any user interaction cancels it. */
function setupScrollHints(){
 const BOUNCES=4,PAUSE_MS=1100,BOUNCE_MS=1300,DELAY_MS=1800;
 let timer=0,loopTimer=0;
 const shown=new Set();
 const active=()=>document.querySelector('.screen.active');
 const stop=(remember=false)=>{clearTimeout(timer);clearTimeout(loopTimer);const screen=active();if(screen){screen.classList.remove('scroll-cue');if(remember)shown.add(screen.id);}};
 const bounce=(screen,left)=>{
  if(left<=0||!screen.classList.contains('active'))return;
  screen.classList.remove('scroll-cue');void screen.offsetWidth;screen.classList.add('scroll-cue');
  loopTimer=setTimeout(()=>{
   screen.classList.remove('scroll-cue');
   loopTimer=setTimeout(()=>bounce(screen,left-1),PAUSE_MS);
  },BOUNCE_MS);
 };
 const schedule=()=>{
  stop();const screen=active();if(!screen||shown.has(screen.id))return;
  timer=setTimeout(()=>{
   if(document.hidden||introActive||storyRelease||meaningRelease||searchRelease||document.body.classList.contains('modal-open')||document.body.classList.contains('keyboard-open'))return;
   const visibleBottom=(window.visualViewport?.offsetTop||0)+(window.visualViewport?.height||innerHeight);
   if(screen.getBoundingClientRect().bottom<=visibleBottom+48)return;
   shown.add(screen.id);bounce(screen,BOUNCES);
  },DELAY_MS);
 };
 ['touchstart','pointerdown','wheel','keydown'].forEach(name=>document.addEventListener(name,()=>stop(true),{passive:true}));
 addEventListener('scroll',()=>stop(true),{passive:true});
 const observer=new MutationObserver(schedule);
 document.querySelectorAll('.screen').forEach(el=>observer.observe(el,{childList:true,subtree:true,characterData:true}));
 const screens=new MutationObserver(records=>{
  let toggled=false;
  records.forEach(r=>{
   const wasActive=(r.oldValue||'').split(' ').includes('active'),isActive=r.target.classList.contains('active');
   if(isActive===wasActive)return;
   toggled=true;
   if(isActive)shown.delete(r.target.id);
  });
  if(toggled)schedule();
 });
 document.querySelectorAll('.screen').forEach(el=>screens.observe(el,{attributes:true,attributeOldValue:true,attributeFilter:['class']}));
 schedule();
}
setupScrollHints();

/* 3.1.3.6: sticky topbar — the gear stays fixed; the headline shrinks to icon height on scroll.
   Only `transform: scale()` ever touches the phrase, so glyphs are never cropped mid-line;
   the freed-up space is reclaimed with a negative margin instead of a forced pixel height,
   so the sticky bar's own box always matches what's actually on screen (no torn seam). */
function setupCollapsingHeader(){
 const topbar=$('topbar'),wrap=$('headlineShrink');
 if(!topbar||!wrap)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const COLLAPSED=50,DISTANCE=90;
 let naturalHeight=0,minScale=1,ticking=false;
 const measure=()=>{
  wrap.style.transform='';wrap.style.marginBottom='';
  naturalHeight=wrap.offsetHeight||1;
  minScale=Math.max(COLLAPSED/naturalHeight,.32);
  apply();
 };
 const apply=()=>{
  const t=Math.max(0,Math.min(1,scrollY/DISTANCE));
  const scale=1-(1-minScale)*t;
  wrap.style.transform=`scale(${scale})`;
  wrap.style.marginBottom=(-(1-scale)*naturalHeight)+'px';
  topbar.classList.toggle('is-condensed',t>0.06);
  ticking=false;
 };
 addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(apply);}},{passive:true});
 addEventListener('resize',measure);
 document.fonts?.ready?.then(measure);
 measure();
}
setupCollapsingHeader();
})();

