async function y(e){const n=e==null?"":String(e);return typeof navigator<"u"&&typeof navigator.clipboard?.writeText=="function"?await navigator.clipboard.writeText(n):new Promise((a,s)=>{try{const r=document.createElement("textarea");r.value=n,r.setAttribute("readonly","");const t=r.style;t.position="fixed",t.top="0",t.left="0",t.width="1px",t.height="1px",t.padding="0",t.border="0",t.outline="none",t.boxShadow="none",t.background="transparent",t.opacity="0",document.body.appendChild(r),r.focus(),r.select();let d=!1;try{d=document.execCommand("copy")}catch(l){return s(l)}finally{document.body.removeChild(r)}d?a():s(new Error("Copy command unsuccessful"))}catch(r){s(r)}})}async function k(e,n={}){const{successMessage:a="复制成功",errorMessage:s="复制失败",showToast:r=!0,duration:t=3e3,type:d="success",position:l="top-right",showProgress:i=!0,pauseOnHover:o=!0}=n;try{return await y(e),r&&b({type:"success",message:a,duration:t,position:l,showProgress:i,pauseOnHover:o}),{success:!0,text:e}}catch(u){return console.error("Copy failed:",u),r&&b({type:"error",message:s,duration:t+1e3,showProgress:i,pauseOnHover:o}),{success:!1,error:u}}}let p=null,x=0;function h(){return p||(p=document.createElement("div"),p.className="modern-toast-container",p.setAttribute("aria-live","polite"),p.setAttribute("aria-label","Notifications"),Object.assign(p.style,{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",zIndex:"9999",pointerEvents:"none",display:"flex",flexDirection:"column",gap:"8px",maxWidth:"320px",width:"auto"}),document.body.appendChild(p)),p}function b(e={}){const{type:n="success",message:a="",duration:s=3e3,showProgress:r=!0,pauseOnHover:t=!0,closable:d=!0}=e,l=h(),i=`toast-${Date.now()}-${++x}`,o=document.createElement("div");o.className=`modern-toast modern-toast-${n}`,o.setAttribute("role",n==="error"?"alert":"status"),o.setAttribute("aria-live",n==="error"?"assertive":"polite"),o.setAttribute("data-toast-id",i),Object.assign(o.style,{background:"#ffffff",color:"#1f2937",padding:"12px 16px",borderRadius:"6px",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.15)",fontSize:"13px",fontWeight:"500",pointerEvents:"auto",position:"relative",overflow:"hidden",minWidth:"240px",maxWidth:"320px",wordWrap:"break-word",borderLeft:"3px solid transparent",display:"flex",alignItems:"center",gap:"10px",transition:"all 0.3s ease",opacity:"0",transform:"translateY(-20px)",fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'});const u={success:{borderLeftColor:"#10b981",background:"linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))"},error:{borderLeftColor:"#ef4444",background:"linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))"},warning:{borderLeftColor:"#f59e0b",background:"linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05))"},info:{borderLeftColor:"#3b82f6",background:"linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))"}};Object.assign(o.style,u[n]||u.info);const g=v(n,a,d,r);return o.innerHTML=g,l.appendChild(o),w(o,i,s,t,r),requestAnimationFrame(()=>{o.style.opacity="1",o.style.transform="translateY(0)",n==="error"?o.style.animation="shake 0.5s ease-in-out":n==="success"&&(o.style.animation="slideInDown 0.4s ease-out")}),i}function v(e,n,a,s){const r={success:"✅",error:"❌",warning:"⚠️",info:"ℹ️"};let t=`
        <div class="toast-icon" style="font-size: 18px; flex-shrink: 0;">
            ${r[e]||r.info}
        </div>
        <div class="toast-content" style="flex: 1; line-height: 1.5;">
            ${n}
        </div>
    `;return a&&(t+=`
            <button class="toast-close" style="
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                border: none;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: #6b7280;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(0, 0, 0, 0.2)'"
               onmouseout="this.style.background='rgba(0, 0, 0, 0.1)'">
                ×
            </button>
        `),s&&(t+=`
            <div class="toast-progress" style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: currentColor;
                opacity: 0.3;
                transition: width linear;
                width: 100%;
            "></div>
        `),t}function w(e,n,a,s,r){let t=null,d=null,l=a,i=!1;const o=e.querySelector(".toast-close");o&&o.addEventListener("click",()=>f(e)),e.addEventListener("click",()=>f(e)),e.style.cursor="pointer";function u(){if(a>0&&(d=Date.now(),t=setTimeout(()=>{f(e)},l),r)){const c=e.querySelector(".toast-progress");c&&(c.style.transition=`width ${l}ms linear`,requestAnimationFrame(()=>{c.style.width="0%"}))}}function g(){if(t&&!i&&(clearTimeout(t),l-=Date.now()-d,i=!0,r)){const c=e.querySelector(".toast-progress");c&&(c.style.transition="none")}}function m(){i&&l>0&&(u(),i=!1)}s&&(e.addEventListener("mouseenter",g),e.addEventListener("mouseleave",m)),e.addEventListener("keydown",c=>{(c.key==="Escape"||c.key==="Enter")&&f(e)}),u()}function f(e){e&&e.parentNode&&(e.style.opacity="0",e.style.transform="translateY(-20px)",setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},300))}export{k as a,y as c};
