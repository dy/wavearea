import{f as j}from"./chunk-YHXHCA4V.js";import"./chunk-ON5OQYWL.js";var O,Y=new Set,q,Q=new WeakMap,M=new WeakMap,J=new WeakMap,I=Symbol("parent"),z={Array,Object,Number,String,Boolean,Date,console},G={has(){return!0},get(e,t){if(typeof t=="symbol")return e[t];if(!(t in e))return e[I]?.[t];if(Array.isArray(e)&&t in Array.prototype)return e[t];let r=e[t];if(O){let n=Q.get(e);n||Q.set(e,n={}),n[t]?n[t].includes(O)||n[t].push(O):n[t]=[O]}if(r&&r.constructor===Object||Array.isArray(r)){let n=M.get(r);return n||M.set(r,n=new Proxy(r,G)),n}return r},set(e,t,r){if(!(t in e)&&e[I]&&t in e[I])return e[I][t]=r;if(Array.isArray(e)&&t in Array.prototype)return e[t]=r;let n=e[t];if(Object.is(n,r))return!0;e[t]=r;let s=Q.get(e)?.[t];if(s)for(let a of s)Y.add(a);return ye(),!0},deleteProperty(e,t){return e[t]=void 0,delete e[t],!0}},E=(e,t)=>{if(M.has(e))return M.get(e);if(J.has(e))return e;let r=new Proxy(e,G);return M.set(e,r),J.set(r,e),e[I]=t?E(t):z,r},H=e=>{let t=()=>{let r=O;O=t,e(),O=r};return t(),t},ye=()=>{q||(q=!0,queueMicrotask(()=>{for(let e of Y)e.call();Y.clear(),q=!1}))};function V(e,t,r,n){let s=new Map,a=new Map,o,i;for(o=0;o<t.length;o++)s.set(t[o],o);for(o=0;o<r.length;o++)a.set(r[o],o);for(o=i=0;o!==t.length||i!==r.length;){var c=t[o],u=r[i];if(c===null)o++;else if(r.length<=i)e.removeChild(t[o]),o++;else if(t.length<=o)e.insertBefore(u,t[o]||n),i++;else if(c===u)o++,i++;else{var h=a.get(c),f=s.get(u);h===void 0?(e.removeChild(t[o]),o++):f===void 0?(e.insertBefore(u,t[o]||n),i++):(e.insertBefore(t[f],t[o]||n),t[f]=null,f>o+1&&o++,i++)}}return r}var ee=new WeakMap,ve=e=>{let t=new WeakRef(e);return ee.set(e,t),t},we=e=>ee.get(e)||ve(e),D=class extends Map{#e=new FinalizationRegistry(t=>super.delete(t));get size(){return[...this].length}constructor(t=[]){super();for(let[r,n]of t)this.set(r,n)}get(t){return super.get(t)?.deref()}set(t,r){let n=super.get(t);return n&&this.#e.unregister(n),n=we(r),this.#e.register(r,t,n),super.set(t,n)}};var N={},b={};N.if=(e,t)=>{let r=document.createTextNode(""),n=[m(e,t,":if")],s=[e],a=e;for(;(a=e.nextElementSibling)&&a.hasAttribute(":else");)a.removeAttribute(":else"),(t=a.getAttribute(":if"))?(a.removeAttribute(":if"),a.remove(),s.push(a),n.push(m(e,t,":else :if"))):(a.remove(),s.push(a),n.push(()=>1));return e.replaceWith(a=r),o=>{let i=n.findIndex(c=>c(o));s[i]!=a&&((a[re]||a).replaceWith(a=s[i]||r),C(a,o))}};N.with=(e,t,r)=>{let s=m(e,t,"with")(r),a=E(s,r);C(e,a)};var re=Symbol(":each");N.each=(e,t)=>{let r=Ae(t);if(!r)return W(new Error,e,t);let n=e[re]=document.createTextNode("");e.replaceWith(n);let s=m(e,r[2],":each"),a=e.getAttribute(":key"),o=a?m(null,a):null;e.removeAttribute(":key");let i=e.getAttribute(":ref"),c=new D,u=new D,h=[];return f=>{let d=s(f);d?typeof d=="number"?d=Array.from({length:d},(y,v)=>[v,v+1]):Array.isArray(d)?d=d.map((y,v)=>[v+1,y]):typeof d=="object"?d=Object.entries(d):W(Error("Bad list value"),e,t,":each",d):d=[];let x=[],L=[];for(let[y,v]of d){let P,B,k=o?.({[r[0]]:v,[r[1]]:y});k==null?P=e.cloneNode(!0):(P=u.get(k))||u.set(k,P=e.cloneNode(!0)),x.push(P),k==null||!(B=c.get(k))?(B=E({[r[0]]:v,[i||""]:null,[r[1]]:y},f),k!=null&&c.set(k,B)):B[r[0]]=v,L.push(B)}V(n.parentNode,h,x,n),h=x;for(let y=0;y<x.length;y++)C(x[y],L[y])}};function Ae(e){let t=/,([^,\}\]]*)(?:,([^,\}\]]*))?$/,r=/^\s*\(|\)\s*$/g,n=/([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/,s=e.match(n);if(!s)return;let a=s[2].trim(),o=s[1].replace(r,"").trim(),i=o.match(t);return i?[o.replace(t,"").trim(),i[1].trim(),a]:[o,"",a]}b.ref=(e,t,r)=>{r[t]=e};b.id=(e,t)=>{let r=m(e,t,":id"),n=s=>e.id=s||s===0?s:"";return s=>n(r(s))};b.class=(e,t)=>{let r=m(e,t,":class"),n=e.className;return s=>{let a=r(s),o=typeof a=="string"?a:(Array.isArray(a)?a:Object.entries(a).map(([i,c])=>c?i:"")).filter(Boolean).join(" ");e.className=[n,o].filter(Boolean).join(" ")}};b.style=(e,t)=>{let r=m(e,t,":style"),n=e.getAttribute("style")||"";return n.endsWith(";")||(n+="; "),s=>{let a=r(s);if(typeof a=="string")e.setAttribute("style",n+a);else{e.setAttribute("style",n);for(let o in a)e.style.setProperty(o,a[o])}}};b.text=(e,t)=>{let r=m(e,t,":text");return n=>{let s=r(n);e.textContent=s??""}};b.data=(e,t)=>{let r=m(e,t,":data");return n=>{let s=r(n);for(let a in s)e.dataset[a]=s[a]}};b.aria=(e,t)=>{let r=m(e,t,":aria"),n=s=>{for(let a in s)$(e,"aria-"+se(a),s[a]==null?null:s[a]+"")};return s=>n(r(s))};b[""]=(e,t)=>{let r=m(e,t,":");if(r)return n=>{let s=r(n);for(let a in s)$(e,se(a),s[a])}};b.value=(e,t)=>{let r=m(e,t,":value"),n,s,a=e.type==="text"||e.type===""?o=>e.setAttribute("value",e.value=o??""):e.tagName==="TEXTAREA"||e.type==="text"||e.type===""?o=>(n=e.selectionStart,s=e.selectionEnd,e.setAttribute("value",e.value=o??""),n&&e.setSelectionRange(n,s)):e.type==="checkbox"?o=>(e.value=o?"on":"",$(e,"checked",o)):e.type==="select-one"?o=>{for(let i in e.options)i.removeAttribute("selected");e.value=o,e.selectedOptions[0]?.setAttribute("selected","")}:o=>e.value=o;return o=>a(r(o))};b.on=(e,t)=>{let r=m(e,t,":on");return n=>{let s=r(n),a=[];for(let o in s)a.push(ae(e,o,s[o]));return()=>{for(let o of a)o()}}};var ne=(e,t,r,n)=>{let s=n.startsWith("on")&&n.slice(2),a=m(e,t,":"+n);if(a)return s?o=>{let i=a(o)||(()=>{});return ae(e,s,i)}:o=>$(e,n,a(o))},ae=(e,t,r)=>{if(!r)return;let n=t.split("..").map(i=>{let c={evt:"",target:e,test:()=>!0};return c.evt=(i.startsWith("on")?i.slice(2):i).replace(/\.(\w+)?-?([-\w]+)?/g,(u,h,f="")=>(c.test=be[h]?.(c,...f.split("-"))||c.test,"")),c});if(n.length==1)return o(r,n[0]);let s=(i,c=0)=>{let u;return u=o(f=>{c&&u();let d=i.call(e,f);typeof d!="function"&&(d=()=>{}),c+1<n.length&&s(d,c?c+1:1)},n[c])},a=s(r);return()=>a();function o(i,{evt:c,target:u,test:h,defer:f,stop:d,prevent:x,...L}){f&&(i=f(i));let y=v=>h(v)&&(d&&v.stopPropagation(),x&&v.preventDefault(),i.call(u,v));return u.addEventListener(c,y,L),()=>u.removeEventListener(c,y,L)}},be={prevent(e){e.prevent=!0},stop(e){e.stop=!0},once(e){e.once=!0},passive(e){e.passive=!0},capture(e){e.capture=!0},window(e){e.target=window},document(e){e.target=document},toggle(e){e.defer=(t,r)=>n=>r?(r.call?.(e.target,n),r=null):r=t()},throttle(e,t){e.defer=r=>xe(r,t?Number(t)||0:108)},debounce(e,t){e.defer=r=>Ce(r,t?Number(t)||0:108)},outside:e=>t=>{let r=e.target;return!(r.contains(t.target)||t.target.isConnected===!1||r.offsetWidth<1&&r.offsetHeight<1)},self:e=>t=>t.target===e.target,ctrl:(e,...t)=>r=>p.ctrl(r)&&t.every(n=>p[n]?p[n](r):r.key===n),shift:(e,...t)=>r=>p.shift(r)&&t.every(n=>p[n]?p[n](r):r.key===n),alt:(e,...t)=>r=>p.alt(r)&&t.every(n=>p[n]?p[n](r):r.key===n),meta:(e,...t)=>r=>p.meta(r)&&t.every(n=>p[n]?p[n](r):r.key===n),arrow:e=>p.arrow,enter:e=>p.enter,escape:e=>p.escape,tab:e=>p.tab,space:e=>p.space,backspace:e=>p.backspace,delete:e=>p.delete,digit:e=>p.digit,letter:e=>p.letter,character:e=>p.character},p={ctrl:e=>e.ctrlKey||e.key==="Control"||e.key==="Ctrl",shift:e=>e.shiftKey||e.key==="Shift",alt:e=>e.altKey||e.key==="Alt",meta:e=>e.metaKey||e.key==="Meta"||e.key==="Command",arrow:e=>e.key.startsWith("Arrow"),enter:e=>e.key==="Enter",escape:e=>e.key.startsWith("Esc"),tab:e=>e.key==="Tab",space:e=>e.key==="\xA0"||e.key==="Space"||e.key===" ",backspace:e=>e.key==="Backspace",delete:e=>e.key==="Delete",digit:e=>/^\d$/.test(e.key),letter:e=>/^[a-zA-Z]$/.test(e.key),character:e=>/^\S$/.test(e.key)},xe=(e,t)=>{let r,n,s=a=>{r=!0,setTimeout(()=>{if(r=!1,n)return n=!1,s(a),e(a)},t)};return a=>r?n=!0:(s(a),e(a))},Ce=(e,t)=>{let r;return n=>{clearTimeout(r),r=setTimeout(()=>{r=null,e(n)},t)}},$=(e,t,r)=>{r==null||r===!1?e.removeAttribute(t):e.setAttribute(t,r===!0?"":typeof r=="number"||typeof r=="string"?r:"")},te={};function m(e,t,r){let n=te[t];if(!n){let s=/^[\n\s]*if.*\(.*\)/.test(t)||/\b(let|const)\s/.test(t)&&!r.startsWith(":on")?`(() => {${t}})()`:t;try{n=te[t]=new Function("__scope",`with (__scope) { return ${s.trim()} };`)}catch(a){return W(a,e,t,r)}}return s=>{let a;try{a=n.call(e,s)}catch(o){return W(o,e,t,r)}return a}}function W(e,t,r,n){Object.assign(e,{element:t,expression:r}),console.warn(`\u2234 ${e.message}

${n}=${r?`"${r}"

`:""}`,t),queueMicrotask(()=>{throw e},0)}function se(e){return e.replace(/[A-Z\u00C0-\u00D6\u00D8-\u00DE]/g,t=>"-"+t.toLowerCase())}C.globals=z;var _=new WeakMap;function C(e,t){if(!e.children)return;if(_.has(e))return Object.assign(_.get(e),t);let r=E(t||{}),n=[],s=(a,o=a.parentNode)=>{for(let i in N){let c=":"+i;if(a.hasAttribute?.(c)){let u=a.getAttribute(c);if(a.removeAttribute(c),n.push(N[i](a,u,r,i)),_.has(a)||a.parentNode!==o)return!1}}if(a.attributes)for(let i=0;i<a.attributes.length;){let c=a.attributes[i];if(c.name[0]!==":"){i++;continue}a.removeAttribute(c.name);let u=c.value,h=c.name.slice(1).split(":");for(let f of h){let d=b[f]||ne;if(n.push(d(a,u,r,f)),_.has(a)||a.parentNode!==o)return!1}}for(let i=0,c;c=a.children[i];i++)s(c,a)===!1&&i--};s(e);for(let a of n)if(a){let o;H(()=>{typeof o=="function"&&o(),o=a(r)})}return _.set(e,r),r}var K=C;function X(e,t){if(!t)return e.play(),()=>e.pause();t.start||=0,e.currentTime=t.start;let r=()=>{if(e.readyState===0)return;let i=e.preload==="auto";i&&(e.preload="none"),e.currentTime<0&&(e.currentTime=0),e.currentTime>t.end&&(e.currentTime=t.end),i&&(e.preload="auto")},n,s=()=>{if(clearInterval(n),e.currentTime>=t.end){if(e.loop){e.currentTime=t.start;return}e.pause(),e.dispatchEvent(new Event("ended"));return}e.currentTime+.2>t.end&&(n=setInterval(s,10))},a=()=>{e.currentTime>=t.end&&(e.currentTime=t.start)};e.addEventListener("durationchange",r),e.addEventListener("seeking",r),e.addEventListener("timeupdate",s);let o=setInterval(s,50);return e.addEventListener("playing",a),e.play(),()=>{e.removeEventListener("durationchange",r),e.removeEventListener("seeking",r),e.removeEventListener("timeupdate",s),e.removeEventListener("playing",a),clearInterval(o),clearInterval(n),e.pause()}}var S=new Audio("data:audio/wav;base64,UklGRmgAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQIAAABpNUxJU1Q6AAAASU5GT0lTRlQUAAAAcHJvYmUuYXVkaW90b29sLmNvbQBJQ1JEEQAAADIwMjMtMDMtMDIgMDctNDQAAA==");S.preload="metadata";S.load();S.volume=0;async function oe(){return new Promise(e=>{S.play();let t;S.onplaying=()=>t=performance.now(),S.onended=()=>{e(performance.now()-t)}})}history.scrollRestoration="manual";var A=document.querySelector(".wavearea"),w=A.querySelector(".w-editable"),Ze=A.querySelector(".w-played"),le=A.querySelector(".w-timecodes"),ke=A.querySelector(".w-play"),Oe=A.querySelector(".w-waveform"),fe=A.querySelector(".w-caret-line"),g=new Audio,ie=new Worker("./dist/worker.js",{type:"module"}),de=new AudioContext;Object.assign(K.globals,{clearInterval:clearInterval.bind(window),setInterval:setInterval.bind(window),raf:window.requestAnimationFrame.bind(window)});var l=K(A,{loading:!1,recording:!1,playing:!1,selecting:!1,isMouseDown:!1,scrolling:!1,clipStart:0,loop:!1,clipEnd:null,_startTime:0,_startTimeOffset:0,volume:1,latency:0,segments:[],total:0,duration:0,caretOffscreen:0,caretOffset:0,caretY:Oe.getBoundingClientRect().top,caretX:0,cols:216,async handleCaret(){let e=T();!e||e.start===l.caretOffset&&e.collapsed||(l.caretOffset=e.start,l.updateCaretLine(e),l.clipStart=l.caretOffset,l.playing?(l._startTime=(performance.now()+l.latency)*.001,l._startTimeOffset=l.caretOffset):(l.clipEnd=e.collapsed?l.total:e.end,l.loop=g.loop=!e.collapsed),g.currentTime=l.duration*l.caretOffset/l.total)},async handleBeforeInput(e){let t=Te[e.inputType];t?t.call(this,e):(e.preventDefault(),e.stopPropagation(),e.data===". "&&T(l.caretOffset))},async handleDrop(e){let r=e.dataTransfer.files[0];if(!r.type.startsWith("audio"))return!1;l.loading=!0,l.segments=[];let n=await j(r),s=await decodeAudio(n),a=await encodeAudio(s),o=new Blob([a],{type:"audio/wav"}),i=URL.createObjectURL(o);return await applyOp(["src",i]),l.loading=!1,n},async handleFile(e){l.loading="Decoding";let t=e.target.files[0],r=await j(t),n=await de.decodeAudioData(r),s=Array.from({length:n.numberOfChannels},a=>n.getChannelData(a));await he(["file",{name:t.name,numberOfChannels:n.numberOfChannels,sampleRate:n.sampleRate,length:n.length,channelData:s}]),l.loading=!1},scrollIntoCaret(){l.caretOffscreen&&!l.scrolling&&(fe.scrollIntoView({behavior:"smooth",block:"center"}),l.scrolling=!0,setTimeout(()=>l.scrolling=!1,108))},play(e){l.playing=!0,l.scrolling=!1,w.focus(),l.caretOffset===l.total&&T(l.caretOffset=l.clipStart=0),l.scrollIntoCaret();let{clipStart:t,clipEnd:r,loop:n}=l,s=()=>ke.click(),a;l._startTime,l._startTimeOffset=l.caretOffset;let o=async()=>{await new Promise(f=>setTimeout(f,l.latency)),l._startTime=performance.now()*.001,clearInterval(a),a=setInterval(u,20)},i=w.getBoundingClientRect().top,c=()=>{if(l.scrolling)return;let f=w.getBoundingClientRect().top;f!==i?(l.scrolling=!0,setTimeout(()=>(l.scrolling=!1,c()),1080)):l.scrolling=!1,i=f},u=()=>{if(c(),!l.selecting){let f=performance.now()*.001-l._startTime,d=Math.min(l._startTimeOffset+Math.round(l.total*f/l.duration),l.total);n&&(d=Math.min(d,r));let x=T(l.caretOffset=d);l.updateCaretLine(x),l.scrollIntoCaret()}};g.addEventListener("play",o,{once:!0}),l.loop&&g.addEventListener("seeked",o);let h=X(g,l.loop&&{start:l.duration*l.clipStart/l.total,end:l.duration*l.clipEnd/l.total});return g.addEventListener("ended",s),()=>{g.removeEventListener("seeked",o),g.removeEventListener("ended",s),clearInterval(a),h(),l.playing=!1,l.scrolling=!1,l.loop?T(t,r):g.currentTime>=g.duration&&T(l.total),w.focus()}},async goto(e){try{await Z(e)}catch{await ge()}T(l.caretOffset)},updateCaretLine(e){let t=e.range.getClientRects(),r=t[t.length-1];l.caretX=r.right,l.caretY=r.top},updateTimecodes(){if(le.replaceChildren(),!w.textContent)return;let e=0;for(let t of w.children){let r=new Range;r.selectNodeContents(w);let n=Math.round(r.getBoundingClientRect().height/r.getClientRects()[1].height);for(let s=0;s<n;s++){let a=document.createElement("a"),o=ue(s*(l.cols||0)+e);a.href=`#${o}`,a.textContent=o,le.appendChild(a)}e+=t.textContent.length}},timecode:ue}),Te={insertFromDrop(e){console.log("insert from drop",e)},async deleteContentBackward(e){let t=e.getTargetRanges()[0],r=t.startContainer.parentNode.closest(".w-segment"),n=t.endContainer.parentNode.closest(".w-segment"),s=Number(r.dataset.id),a=Number(n.dataset.id),o=t.startOffset+l.segments.slice(0,s).reduce((u,h)=>u+h.length,0),i=t.endOffset+l.segments.slice(0,a).reduce((u,h)=>u+h.length,0);this._deleteTimeout?(clearTimeout(this._deleteTimeout),this._deleteOp[1]--):this._deleteOp=["del",o,i];let c=()=>{he(this._deleteOp),this._deleteOp=this._deleteTimeout=null};this._deleteTimeout=setTimeout(c,280)}},R=async()=>{A.removeEventListener("touchstart",R),A.removeEventListener("mousedown",R),A.removeEventListener("keydown",R),l.latency=await oe(),console.log("measured latency",l.latency)};A.addEventListener("touchstart",R);A.addEventListener("mousedown",R);A.addEventListener("keydown",R);var T=(e,t)=>{let r=window.getSelection();if(e!=null){Array.isArray(e)&&(e=F(...e)),Array.isArray(t)&&(t=F(...t)),e=Math.max(0,e),t==null&&(t=e);let[i,c]=ce(e),[u,h]=ce(t),f=r.getRangeAt(0);if(!(f.startContainer===i.firstChild&&f.startOffset===c)&&!(f.endContainer===u.firstChild&&f.endOffset===h)){r.removeAllRanges();let d=new Range;d.setStart(i.firstChild,c),d.setEnd(u.firstChild,h),r.addRange(d)}return{start:e,startNode:i,end:t,endNode:u,startNodeOffset:c,endNodeOffset:h,collapsed:r.isCollapsed,range:r.getRangeAt(0)}}if(!r.anchorNode||!w.contains(r.anchorNode))return;e=F(r.anchorNode,r.anchorOffset),t=F(r.focusNode,r.focusOffset);let n=r.anchorNode.parentNode.closest(".w-segment"),s=r.anchorOffset,a=r.focusNode.parentNode.closest(".w-segment"),o=r.focusOffset;return e>t&&([t,a,o,e,n,s]=[e,n,s,t,a,o]),{start:e,startNode:n,startNodeOffset:s,end:t,endNode:a,endNodeOffset:o,collapsed:r.isCollapsed,range:r.getRangeAt(0)}};function F(e,t){let r=e.parentNode.closest(".w-segment"),n=U(r.textContent.slice(0,t)).length;for(;r=r.previousSibling;)n+=U(r.textContent).length;return n}function ce(e){let t=w.firstChild,r;for(;e>(r=U(t.textContent).length);)e-=r,t=t.nextSibling;let n=0;for(let s=t.textContent,a=0;a<e;a++)for(;s[a+n]>="\u0300";)n++;return[t,e+n]}function ue(e,t=0){let r=e/l?.total*l?.duration||0;return`${Math.floor(r/60).toFixed(0)}:${(Math.floor(r)%60).toFixed(0).padStart(2,0)}${t?`.${(r%1).toFixed(t).slice(2).padStart(t)}`:""}`}var Ee=new IntersectionObserver(([e])=>{l.caretOffscreen=e.isIntersecting?0:e.intersectionRect.top<=e.rootBounds.top?1:e.intersectionRect.bottom>=e.rootBounds.bottom?-1:0},{threshold:.999,rootMargin:"0px"});Ee.observe(fe);var Ne=new ResizeObserver(e=>{l.cols=pe(),l.updateTimecodes()});Ne.observe(w);function pe(){let e=new Range,t=w.firstChild.firstChild;if(!t?.textContent)return;let r=t.textContent;e.setStart(t,0),e.setEnd(t,1);let n=e.getClientRects()[0].y;for(var s=0,a=0;s<r.length;a++){let o=1;for(;r[s+o]>="\u0300";)o++;e.setStart(t,0),e.setEnd(t,s=s+o);let i=e.getClientRects();if(i[i.length-1].y>n)return a}return r.length}async function he(...e){let t=new URL(location);for(let n of e){let[s,...a]=n;a[0].name?t.searchParams.set(s,a[0].name):t.searchParams.has(s)?t.searchParams.set(s,`${t.searchParams.get(s)}..${a.join("-")}`):t.searchParams.append(s,a.join("-"))}l.loading="Processing";let r=await me(...e);return history.pushState(r,"",decodeURI(t)),l.loading=!1,w.textContent&&console.assert(r.segments.join("")===w.textContent,"Rendered waveform is different from UI"),Z(r)}function me(...e){return new Promise(t=>{ie.postMessage({id:history.state?.id||0,ops:e}),ie.addEventListener("message",r=>{t(r.data)},{once:!0})})}function U(e){return e.replace(/\u0300|\u0301/g,"")}function Z({url:e,segments:t,duration:r,offsets:n}){return l.total=t.reduce((s,a)=>s+=U(a).length,0),l.duration=r,l.segments=t,l.cols||(l.cols=pe()),l.updateTimecodes(),g.src=e,g.preload="metadata",new Promise((s,a)=>{g.addEventListener("error",a),g.addEventListener("loadedmetadata",()=>{g.currentTime=r*l.caretOffset/l.total||0},{once:!0})})}async function ge(e=new URL(location)){l.loading="Fetching";let t=[];for(let[n,s]of e.searchParams)t.push(...s.split("..").map(a=>[n,...n==="src"||n==="file"?[a]:a.split("-")]));if(t[0][0]==="src"){let[,n]=t.shift(),a=await(await fetch(n,{cache:"force-cache"})).arrayBuffer();l.loading="Decoding";let o=await de.decodeAudioData(a),i=Array.from({length:o.numberOfChannels},c=>o.getChannelData(c));t.push(["file",{name:n,numberOfChannels:o.numberOfChannels,sampleRate:o.sampleRate,length:o.length,channelData:i}])}let r=await me(...t);history.replaceState(r,"",decodeURI(e)),Z(r),l.loading=!1}location.search.length&&ge();
//# sourceMappingURL=wavearea.js.map
