var E,Q=new Set,q,j=new WeakMap,B=new WeakMap,G=new WeakMap,M=Symbol("parent"),K={Array,Object,Number,String,Boolean,Date,console},X={has(){return!0},get(e,t){if(typeof t=="symbol")return e[t];if(!(t in e))return e[M]?.[t];if(Array.isArray(e)&&t in Array.prototype)return e[t];let r=e[t];if(E){let n=j.get(e);n||j.set(e,n={}),n[t]?n[t].includes(E)||n[t].push(E):n[t]=[E]}if(r&&r.constructor===Object||Array.isArray(r)){let n=B.get(r);return n||B.set(r,n=new Proxy(r,X)),n}return r},set(e,t,r){if(!(t in e)&&e[M]&&t in e[M])return e[M][t]=r;if(Array.isArray(e)&&t in Array.prototype)return e[t]=r;let n=e[t];if(Object.is(n,r))return!0;e[t]=r;let o=j.get(e)?.[t];if(o)for(let a of o)Q.add(a);return ye(),!0},deleteProperty(e,t){return e[t]=void 0,delete e[t],!0}},R=(e,t)=>{if(B.has(e))return B.get(e);if(G.has(e))return e;let r=new Proxy(e,X);return B.set(e,r),G.set(r,e),e[M]=t?R(t):K,r},H=e=>{let t=()=>{let r=E;E=t,e(),E=r};return t(),t},ye=()=>{q||(q=!0,queueMicrotask(()=>{for(let e of Q)e.call();Q.clear(),q=!1}))};function J(e,t,r,n){let o=new Map,a=new Map,s,i;for(s=0;s<t.length;s++)o.set(t[s],s);for(s=0;s<r.length;s++)a.set(r[s],s);for(s=i=0;s!==t.length||i!==r.length;){var c=t[s],u=r[i];if(c===null)s++;else if(r.length<=i)e.removeChild(t[s]),s++;else if(t.length<=s)e.insertBefore(u,t[s]||n),i++;else if(c===u)s++,i++;else{var m=a.get(c),f=o.get(u);m===void 0?(e.removeChild(t[s]),s++):f===void 0?(e.insertBefore(u,t[s]||n),i++):(e.insertBefore(t[f],t[s]||n),t[f]=null,f>s+1&&s++,i++)}}return r}var ee=new WeakMap,we=e=>{let t=new WeakRef(e);return ee.set(e,t),t},ve=e=>ee.get(e)||we(e),_=class extends Map{#e=new FinalizationRegistry(t=>super.delete(t));get size(){return[...this].length}constructor(t=[]){super();for(let[r,n]of t)this.set(r,n)}get(t){return super.get(t)?.deref()}set(t,r){let n=super.get(t);return n&&this.#e.unregister(n),n=ve(r),this.#e.register(r,t,n),super.set(t,n)}};var b={},C={};b.if=(e,t)=>{let r=document.createTextNode(""),n=[p(e,t,":if")],o=[e],a=e;for(;(a=e.nextElementSibling)&&a.hasAttribute(":else");)a.removeAttribute(":else"),(t=a.getAttribute(":if"))?(a.removeAttribute(":if"),a.remove(),o.push(a),n.push(p(e,t,":else :if"))):(a.remove(),o.push(a),n.push(()=>1));return e.replaceWith(a=r),s=>{let i=n.findIndex(c=>c(s));o[i]!=a&&((a[re]||a).replaceWith(a=o[i]||r),O(a,s))}};b.with=(e,t,r)=>{let o=p(e,t,"with")(r),a=R(o,r);O(e,a)};var re=Symbol(":each");b.each=(e,t)=>{let r=Ae(t);if(!r)return P(new Error,e,t);let n=e[re]=document.createTextNode("");e.replaceWith(n);let o=p(e,r[2],":each"),a=e.getAttribute(":key"),s=a?p(null,a):null;e.removeAttribute(":key");let i=e.getAttribute(":ref"),c=new _,u=new _,m=[];return f=>{let d=o(f);d?typeof d=="number"?d=Array.from({length:d},(y,w)=>[w,w+1]):Array.isArray(d)?d=d.map((y,w)=>[w+1,y]):typeof d=="object"?d=Object.entries(d):P(Error("Bad list value"),e,t,":each",d):d=[];let x=[],S=[];for(let[y,w]of d){let F,N,k=s?.({[r[0]]:w,[r[1]]:y});k==null?F=e.cloneNode(!0):(F=u.get(k))||u.set(k,F=e.cloneNode(!0)),x.push(F),k==null||!(N=c.get(k))?(N=R({[r[0]]:w,[i||""]:null,[r[1]]:y},f),k!=null&&c.set(k,N)):N[r[0]]=w,S.push(N)}J(n.parentNode,m,x,n),m=x;for(let y=0;y<x.length;y++)O(x[y],S[y])}};function Ae(e){let t=/,([^,\}\]]*)(?:,([^,\}\]]*))?$/,r=/^\s*\(|\)\s*$/g,n=/([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/,o=e.match(n);if(!o)return;let a=o[2].trim(),s=o[1].replace(r,"").trim(),i=s.match(t);return i?[s.replace(t,"").trim(),i[1].trim(),a]:[s,"",a]}C.ref=(e,t,r)=>{r[t]=e};C.id=(e,t)=>{let r=p(e,t,":id"),n=o=>e.id=o||o===0?o:"";return o=>n(r(o))};C.class=(e,t)=>{let r=p(e,t,":class"),n=e.className;return o=>{let a=r(o),s=typeof a=="string"?a:(Array.isArray(a)?a:Object.entries(a).map(([i,c])=>c?i:"")).filter(Boolean).join(" ");e.className=[n,s].filter(Boolean).join(" ")}};C.style=(e,t)=>{let r=p(e,t,":style"),n=e.getAttribute("style")||"";return n.endsWith(";")||(n+="; "),o=>{let a=r(o);if(typeof a=="string")e.setAttribute("style",n+a);else{e.setAttribute("style",n);for(let s in a)e.style.setProperty(s,a[s])}}};C.text=(e,t)=>{let r=p(e,t,":text");return n=>{let o=r(n);e.textContent=o??""}};C.data=(e,t)=>{let r=p(e,t,":data");return n=>{let o=r(n);for(let a in o)e.dataset[a]=o[a]}};C.aria=(e,t)=>{let r=p(e,t,":aria"),n=o=>{for(let a in o)U(e,"aria-"+oe(a),o[a]==null?null:o[a]+"")};return o=>n(r(o))};C[""]=(e,t)=>{let r=p(e,t,":");if(r)return n=>{let o=r(n);for(let a in o)U(e,oe(a),o[a])}};C.value=(e,t)=>{let r=p(e,t,":value"),n,o,a=e.type==="text"||e.type===""?s=>e.setAttribute("value",e.value=s??""):e.tagName==="TEXTAREA"||e.type==="text"||e.type===""?s=>(n=e.selectionStart,o=e.selectionEnd,e.setAttribute("value",e.value=s??""),n&&e.setSelectionRange(n,o)):e.type==="checkbox"?s=>(e.value=s?"on":"",U(e,"checked",s)):e.type==="select-one"?s=>{for(let i in e.options)i.removeAttribute("selected");e.value=s,e.selectedOptions[0]?.setAttribute("selected","")}:s=>e.value=s;return s=>a(r(s))};C.on=(e,t)=>{let r=p(e,t,":on");return n=>{let o=r(n),a=[];for(let s in o)a.push(ae(e,s,o[s]));return()=>{for(let s of a)s()}}};var ne=(e,t,r,n)=>{let o=n.startsWith("on")&&n.slice(2),a=p(e,t,":"+n);if(a)return o?s=>{let i=a(s)||(()=>{});return ae(e,o,i)}:s=>U(e,n,a(s))},ae=(e,t,r)=>{if(!r)return;let n=t.split("..").map(i=>{let c={evt:"",target:e,test:()=>!0};return c.evt=(i.startsWith("on")?i.slice(2):i).replace(/\.(\w+)?-?([-\w]+)?/g,(u,m,f="")=>(c.test=Ce[m]?.(c,...f.split("-"))||c.test,"")),c});if(n.length==1)return s(r,n[0]);let o=(i,c=0)=>{let u;return u=s(f=>{c&&u();let d=i.call(e,f);typeof d!="function"&&(d=()=>{}),c+1<n.length&&o(d,c?c+1:1)},n[c])},a=o(r);return()=>a();function s(i,{evt:c,target:u,test:m,defer:f,stop:d,prevent:x,...S}){f&&(i=f(i));let y=w=>m(w)&&(d&&w.stopPropagation(),x&&w.preventDefault(),i.call(u,w));return u.addEventListener(c,y,S),()=>u.removeEventListener(c,y,S)}},Ce={prevent(e){e.prevent=!0},stop(e){e.stop=!0},once(e){e.once=!0},passive(e){e.passive=!0},capture(e){e.capture=!0},window(e){e.target=window},document(e){e.target=document},toggle(e){e.defer=(t,r)=>n=>r?(r.call?.(e.target,n),r=null):r=t()},throttle(e,t){e.defer=r=>xe(r,t?Number(t)||0:108)},debounce(e,t){e.defer=r=>Oe(r,t?Number(t)||0:108)},outside:e=>t=>{let r=e.target;return!(r.contains(t.target)||t.target.isConnected===!1||r.offsetWidth<1&&r.offsetHeight<1)},self:e=>t=>t.target===e.target,ctrl:(e,...t)=>r=>h.ctrl(r)&&t.every(n=>h[n]?h[n](r):r.key===n),shift:(e,...t)=>r=>h.shift(r)&&t.every(n=>h[n]?h[n](r):r.key===n),alt:(e,...t)=>r=>h.alt(r)&&t.every(n=>h[n]?h[n](r):r.key===n),meta:(e,...t)=>r=>h.meta(r)&&t.every(n=>h[n]?h[n](r):r.key===n),arrow:e=>h.arrow,enter:e=>h.enter,escape:e=>h.escape,tab:e=>h.tab,space:e=>h.space,backspace:e=>h.backspace,delete:e=>h.delete,digit:e=>h.digit,letter:e=>h.letter,character:e=>h.character},h={ctrl:e=>e.ctrlKey||e.key==="Control"||e.key==="Ctrl",shift:e=>e.shiftKey||e.key==="Shift",alt:e=>e.altKey||e.key==="Alt",meta:e=>e.metaKey||e.key==="Meta"||e.key==="Command",arrow:e=>e.key.startsWith("Arrow"),enter:e=>e.key==="Enter",escape:e=>e.key.startsWith("Esc"),tab:e=>e.key==="Tab",space:e=>e.key==="\xA0"||e.key==="Space"||e.key===" ",backspace:e=>e.key==="Backspace",delete:e=>e.key==="Delete",digit:e=>/^\d$/.test(e.key),letter:e=>/^[a-zA-Z]$/.test(e.key),character:e=>/^\S$/.test(e.key)},xe=(e,t)=>{let r,n,o=a=>{r=!0,setTimeout(()=>{if(r=!1,n)return n=!1,o(a),e(a)},t)};return a=>r?n=!0:(o(a),e(a))},Oe=(e,t)=>{let r;return n=>{clearTimeout(r),r=setTimeout(()=>{r=null,e(n)},t)}},U=(e,t,r)=>{r==null||r===!1?e.removeAttribute(t):e.setAttribute(t,r===!0?"":typeof r=="number"||typeof r=="string"?r:"")},te={};function p(e,t,r){let n=te[t];if(!n){let o=/^[\n\s]*if.*\(.*\)/.test(t)||/\b(let|const)\s/.test(t)&&!r.startsWith(":on")?`(() => {${t}})()`:t;try{n=te[t]=new Function("__scope",`with (__scope) { return ${o.trim()} };`)}catch(a){return P(a,e,t,r)}}return o=>{let a;try{a=n.call(e,o)}catch(s){return P(s,e,t,r)}return a}}function P(e,t,r,n){Object.assign(e,{element:t,expression:r}),console.warn(`\u2234 ${e.message}

${n}=${r?`"${r}"

`:""}`,t),queueMicrotask(()=>{throw e},0)}function oe(e){return e.replace(/[A-Z\u00C0-\u00D6\u00D8-\u00DE]/g,t=>"-"+t.toLowerCase())}O.globals=K;var I=new WeakMap;function O(e,t){if(!e.children)return;if(I.has(e))return Object.assign(I.get(e),t);let r=R(t||{}),n=[],o=(a,s=a.parentNode)=>{for(let i in b){let c=":"+i;if(a.hasAttribute?.(c)){let u=a.getAttribute(c);if(a.removeAttribute(c),n.push(b[i](a,u,r,i)),I.has(a)||a.parentNode!==s)return!1}}if(a.attributes)for(let i=0;i<a.attributes.length;){let c=a.attributes[i];if(c.name[0]!==":"){i++;continue}a.removeAttribute(c.name);let u=c.value,m=c.name.slice(1).split(":");for(let f of m){let d=C[f]||ne;if(n.push(d(a,u,r,f)),I.has(a)||a.parentNode!==s)return!1}}for(let i=0,c;c=a.children[i];i++)o(c,a)===!1&&i--};o(e);for(let a of n)if(a){let s;H(()=>{typeof s=="function"&&s(),s=a(r)})}return I.set(e,r),r}var V=O;var Y=e=>new Promise((t,r)=>{let n=new FileReader;n.addEventListener("loadend",o=>{t(o.target.result)}),n.addEventListener("error",r),n.readAsArrayBuffer(e)});function Z(e,t){if(!t)return e.play(),()=>e.pause();t.start||=0,e.currentTime=t.start;let r=()=>{if(e.readyState===0)return;let i=e.preload==="auto";i&&(e.preload="none"),e.currentTime<0&&(e.currentTime=0),e.currentTime>t.end&&(e.currentTime=t.end),i&&(e.preload="auto")},n,o=()=>{if(clearInterval(n),e.currentTime>=t.end){if(e.loop){e.currentTime=t.start;return}e.pause(),e.dispatchEvent(new Event("ended"));return}e.currentTime+.2>t.end&&(n=setInterval(o,10))},a=()=>{e.currentTime>=t.end&&(e.currentTime=t.start)};e.addEventListener("durationchange",r),e.addEventListener("seeking",r),e.addEventListener("timeupdate",o);let s=setInterval(o,50);return e.addEventListener("playing",a),e.play(),()=>{e.removeEventListener("durationchange",r),e.removeEventListener("seeking",r),e.removeEventListener("timeupdate",o),e.removeEventListener("playing",a),clearInterval(s),clearInterval(n),e.pause()}}var D=new Audio("data:audio/wav;base64,UklGRmgAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQIAAABpNUxJU1Q6AAAASU5GT0lTRlQUAAAAcHJvYmUuYXVkaW90b29sLmNvbQBJQ1JEEQAAADIwMjMtMDMtMDIgMDctNDQAAA==");D.preload="metadata";D.load();D.volume=0;async function se(){return new Promise(e=>{D.play();let t;D.onplaying=()=>t=performance.now(),D.onended=()=>{e(performance.now()-t)}})}history.scrollRestoration="manual";var A=document.querySelector(".wavearea"),v=A.querySelector(".w-editable"),ut=A.querySelector(".w-played"),le=A.querySelector(".w-timecodes"),Ee=A.querySelector(".w-play"),Te=A.querySelector(".w-waveform"),fe=A.querySelector(".w-caret-line"),g=new Audio,ie=new Worker("./dist/worker.js",{type:"module"}),de=new AudioContext;Object.assign(V.globals,{clearInterval:clearInterval.bind(window),setInterval:setInterval.bind(window),raf:window.requestAnimationFrame.bind(window)});var l=V(A,{loading:!1,recording:!1,playing:!1,selecting:!1,isMouseDown:!1,scrolling:!1,clipStart:0,loop:!1,clipEnd:null,_startTime:0,_startTimeOffset:0,volume:1,latency:0,segments:[],total:0,duration:0,caretOffscreen:0,caretOffset:0,caretY:Te.getBoundingClientRect().top,caretX:0,cols:216,async handleCaret(){let e=T();!e||e.start===l.caretOffset&&e.collapsed||(l.caretOffset=e.start,l.updateCaretLine(e),l.clipStart=l.caretOffset,l.playing?(l._startTime=(performance.now()+l.latency)*.001,l._startTimeOffset=l.caretOffset):(l.clipEnd=e.collapsed?l.total:e.end,l.loop=g.loop=!e.collapsed),g.currentTime=l.duration*l.caretOffset/l.total)},async handleBeforeInput(e){let t=Re[e.inputType];t?t.call(this,e):(e.preventDefault(),e.stopPropagation(),e.data===". "&&T(l.caretOffset))},async handleDrop(e){let r=e.dataTransfer.files[0];if(!r.type.startsWith("audio"))return!1;l.loading=!0,l.segments=[];let n=await Y(r),o=await decodeAudio(n),a=await encodeAudio(o),s=new Blob([a],{type:"audio/wav"}),i=URL.createObjectURL(s);return await applyOp(["src",i]),l.loading=!1,n},async handleFile(e){l.loading="Decoding";let t=e.target.files[0],r=await Y(t),n=await de.decodeAudioData(r),o=Array.from({length:n.numberOfChannels},a=>n.getChannelData(a));await me(["file",{name:t.name,numberOfChannels:n.numberOfChannels,sampleRate:n.sampleRate,length:n.length,channelData:o}]),l.loading=!1},scrollIntoCaret(){l.caretOffscreen&&!l.scrolling&&(fe.scrollIntoView({behavior:"smooth",block:"center"}),l.scrolling=!0,setTimeout(()=>l.scrolling=!1,108))},play(e){l.playing=!0,l.scrolling=!1,v.focus(),l.caretOffset===l.total&&T(l.caretOffset=l.clipStart=0),l.scrollIntoCaret();let{clipStart:t,clipEnd:r,loop:n}=l,o=()=>Ee.click(),a;l._startTime,l._startTimeOffset=l.caretOffset;let s=async()=>{await new Promise(f=>setTimeout(f,l.latency)),l._startTime=performance.now()*.001,clearInterval(a),a=setInterval(u,20)},i=v.getBoundingClientRect().top,c=()=>{if(l.scrolling)return;let f=v.getBoundingClientRect().top;f!==i?(l.scrolling=!0,setTimeout(()=>(l.scrolling=!1,c()),1080)):l.scrolling=!1,i=f},u=()=>{if(c(),!l.selecting){let f=performance.now()*.001-l._startTime,d=Math.min(l._startTimeOffset+Math.round(l.total*f/l.duration),l.total);n&&(d=Math.min(d,r));let x=T(l.caretOffset=d);l.updateCaretLine(x),l.scrollIntoCaret()}};g.addEventListener("play",s,{once:!0}),l.loop&&g.addEventListener("seeked",s);let m=Z(g,l.loop&&{start:l.duration*l.clipStart/l.total,end:l.duration*l.clipEnd/l.total});return g.addEventListener("ended",o),()=>{g.removeEventListener("seeked",s),g.removeEventListener("ended",o),clearInterval(a),m(),l.playing=!1,l.scrolling=!1,l.loop?T(t,r):g.currentTime>=g.duration&&T(l.total),v.focus()}},async goto(e){try{await z(e)}catch{await ge()}T(l.caretOffset)},updateCaretLine(e){let t=e.range.getClientRects(),r=t[t.length-1];l.caretX=r.right,l.caretY=r.top},updateTimecodes(){if(le.replaceChildren(),!v.textContent)return;let e=0;for(let t of v.children){let r=new Range;r.selectNodeContents(v);let n=Math.round(r.getBoundingClientRect().height/r.getClientRects()[1].height);for(let o=0;o<n;o++){let a=document.createElement("a"),s=ue(o*(l.cols||0)+e);a.href=`#${s}`,a.textContent=s,le.appendChild(a)}e+=t.textContent.length}},timecode:ue}),Re={insertFromDrop(e){console.log("insert from drop",e)},async deleteContentBackward(e){let t=e.getTargetRanges()[0],r=t.startContainer.parentNode.closest(".w-segment"),n=t.endContainer.parentNode.closest(".w-segment"),o=Number(r.dataset.id),a=Number(n.dataset.id),s=t.startOffset+l.segments.slice(0,o).reduce((u,m)=>u+m.length,0),i=t.endOffset+l.segments.slice(0,a).reduce((u,m)=>u+m.length,0);this._deleteTimeout?(clearTimeout(this._deleteTimeout),this._deleteOp[1]--):this._deleteOp=["del",s,i];let c=()=>{me(this._deleteOp),this._deleteOp=this._deleteTimeout=null};this._deleteTimeout=setTimeout(c,280)}},L=async()=>{A.removeEventListener("touchstart",L),A.removeEventListener("mousedown",L),A.removeEventListener("keydown",L),l.latency=await se(),console.log("measured latency",l.latency)};A.addEventListener("touchstart",L);A.addEventListener("mousedown",L);A.addEventListener("keydown",L);var T=(e,t)=>{let r=window.getSelection();if(e!=null){Array.isArray(e)&&(e=W(...e)),Array.isArray(t)&&(t=W(...t)),e=Math.max(0,e),t==null&&(t=e);let[i,c]=ce(e),[u,m]=ce(t),f=r.getRangeAt(0);if(!(f.startContainer===i.firstChild&&f.startOffset===c)&&!(f.endContainer===u.firstChild&&f.endOffset===m)){r.removeAllRanges();let d=new Range;d.setStart(i.firstChild,c),d.setEnd(u.firstChild,m),r.addRange(d)}return{start:e,startNode:i,end:t,endNode:u,startNodeOffset:c,endNodeOffset:m,collapsed:r.isCollapsed,range:r.getRangeAt(0)}}if(!r.anchorNode||!v.contains(r.anchorNode))return;e=W(r.anchorNode,r.anchorOffset),t=W(r.focusNode,r.focusOffset);let n=r.anchorNode.parentNode.closest(".w-segment"),o=r.anchorOffset,a=r.focusNode.parentNode.closest(".w-segment"),s=r.focusOffset;return e>t&&([t,a,s,e,n,o]=[e,n,o,t,a,s]),{start:e,startNode:n,startNodeOffset:o,end:t,endNode:a,endNodeOffset:s,collapsed:r.isCollapsed,range:r.getRangeAt(0)}};function W(e,t){let r=e.parentNode.closest(".w-segment"),n=$(r.textContent.slice(0,t)).length;for(;r=r.previousSibling;)n+=$(r.textContent).length;return n}function ce(e){let t=v.firstChild,r;for(;e>(r=$(t.textContent).length);)e-=r,t=t.nextSibling;let n=0;for(let o=t.textContent,a=0;a<e;a++)for(;o[a+n]>="\u0300";)n++;return[t,e+n]}function ue(e,t=0){let r=e/l?.total*l?.duration||0;return`${Math.floor(r/60).toFixed(0)}:${(Math.floor(r)%60).toFixed(0).padStart(2,0)}${t?`.${(r%1).toFixed(t).slice(2).padStart(t)}`:""}`}var be=new IntersectionObserver(([e])=>{l.caretOffscreen=e.isIntersecting?0:e.intersectionRect.top<=e.rootBounds.top?1:e.intersectionRect.bottom>=e.rootBounds.bottom?-1:0},{threshold:.999,rootMargin:"0px"});be.observe(fe);var De=new ResizeObserver(e=>{l.cols=he(),l.updateTimecodes()});De.observe(v);function he(){let e=new Range,t=v.firstChild.firstChild;if(!t?.textContent)return;let r=t.textContent;e.setStart(t,0),e.setEnd(t,1);let n=e.getClientRects()[0].y;for(var o=0,a=0;o<r.length;a++){let s=1;for(;r[o+s]>="\u0300";)s++;e.setStart(t,0),e.setEnd(t,o=o+s);let i=e.getClientRects();if(i[i.length-1].y>n)return a}return r.length}async function me(...e){let t=new URL(location);for(let n of e){let[o,...a]=n;a[0].name?t.searchParams.set(o,a[0].name):t.searchParams.has(o)?t.searchParams.set(o,`${t.searchParams.get(o)}..${a.join("-")}`):t.searchParams.append(o,a.join("-"))}l.loading="Processing";let r=await pe(...e);return history.pushState(r,"",decodeURI(t)),l.loading=!1,v.textContent&&console.assert(r.segments.join("")===v.textContent,"Rendered waveform is different from UI"),z(r)}function pe(...e){return new Promise(t=>{ie.postMessage({id:history.state?.id||0,ops:e}),ie.addEventListener("message",r=>{t(r.data)},{once:!0})})}function $(e){return e.replace(/\u0300|\u0301/g,"")}function z({url:e,segments:t,duration:r,offsets:n}){return l.total=t.reduce((o,a)=>o+=$(a).length,0),l.duration=r,l.segments=t,l.cols||(l.cols=he()),l.updateTimecodes(),g.src=e,g.preload="metadata",new Promise((o,a)=>{g.addEventListener("error",a),g.addEventListener("loadedmetadata",()=>{g.currentTime=r*l.caretOffset/l.total||0},{once:!0})})}async function ge(e=new URL(location)){l.loading="Fetching";let t=[];for(let[n,o]of e.searchParams)t.push(...o.split("..").map(a=>[n,...n==="src"||n==="file"?[a]:a.split("-")]));if(t[0][0]==="src"){let[,n]=t.shift(),a=await(await fetch(n,{cache:"force-cache"})).arrayBuffer();l.loading="Decoding";let s=await de.decodeAudioData(a),i=Array.from({length:s.numberOfChannels},c=>s.getChannelData(c));t.push(["file",{name:n,numberOfChannels:s.numberOfChannels,sampleRate:s.sampleRate,length:s.length,channelData:i}])}let r=await pe(...t);history.replaceState(r,"",decodeURI(e)),z(r),l.loading=!1}location.search.length&&ge();
//# sourceMappingURL=wavearea.js.map
