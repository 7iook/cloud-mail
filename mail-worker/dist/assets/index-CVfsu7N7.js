import{A as H,J as G,G as O,e as v,o as l,g as o,ab as Q,a4 as X,ae as K,F as Z,a9 as tt,a7 as S,p as f,f as _,O as N,h as s,q as R,ao as et,a6 as st,t as m,n as ot,Q as at,af as nt,s as it,ap as j,al as lt,ad as z}from"./index-92mnh-J5.js";import{E as rt}from"./el-image-viewer-DJ_SH_7Y.js";import{E as ct}from"./el-scrollbar-lgMH0mZQ.js";import{E as dt}from"./el-alert-BN_NA9gX.js";import{h as V,i as W,e as q}from"./email-highlight-utils-Dx-h0BtP.js";import{a as P}from"./clipboard-utils-Bf-9Um4a.js";import{_ as U}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{b as ht}from"./email-CA6wn_3x.js";import{I as y}from"./iconify-VCTUy_UH.js";import{u as mt}from"./email-9j19DGMK.js";import{f as ut}from"./day-DI1_lKIq.js";import{s as pt,a as gt}from"./star-BRkLAY2S.js";import{a as ft,g as _t}from"./file-utils-BfzHgCq1.js";import{g as yt}from"./icon-utils-C4KSwKAn.js";import{a as vt}from"./all-email-C1E0Fb3X.js";import{E as wt}from"./index-B-u1Rqw0.js";import"./vnode-DfneDD37.js";import"./index-ChZfA3gH.js";import"./index-CG9L6tLM.js";import"./throttle-BQKBmdXm.js";import"./dayjs.min-BodJrPHb.js";import"./validator-Cw4sOcG_.js";const kt={__name:"index",props:{html:{type:String,required:!0}},setup(F){const b=F,x=H(null),C=H(null);let a=null;function $(){const i=document.createElement("style");document.head.appendChild(i)}function t(){if(!a)return;const i=/<body[^>]*style="([^"]*)"[^>]*>/i,d=b.html.match(i),h=d?d[1]:"";let r=b.html.replace(/<\/?body[^>]*>/gi,"");r=V(r,{highlightEmails:!0,highlightCodes:!0}),a.innerHTML=`
    <style>
      :host {
        all: initial;
        width: 100%;
        height: 100%;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
        font-size: 14px;
        color: #13181D;
        word-break: break-word;
      }

      .shadow-content {
        background: #FFFFFF;
        width: fit-content;
        height: fit-content;
        min-width: 100%;
        ${h||""} /* 注入 body 的 style */
      }

      img:not(table img) {
        max-width: 100% !important;
        height: auto !important;
      }

      /* 高亮样式 - 在 Shadow DOM 中定义 */
      .email-highlight {
        color: #1976d2;
        background-color: rgba(25, 118, 210, 0.12);
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 2px 4px;
        border-radius: 3px;
        position: relative;
        font-weight: 600;
      }

      .email-highlight:hover {
        color: #1565c0;
        background-color: rgba(25, 118, 210, 0.2);
        transform: translateY(-1px);
      }

      .code-highlight {
        color: #ff9800;
        background-color: rgba(255, 152, 0, 0.12);
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-weight: 600;
        position: relative;
      }

      .code-highlight:hover {
        color: #f57c00;
        background-color: rgba(255, 152, 0, 0.2);
        transform: translateY(-1px);
      }

    </style>
    <div class="shadow-content">
      ${r}
    </div>
  `,I()}function I(){if(!a)return;const i=a.querySelector(".shadow-content");i&&i.addEventListener("click",d=>{const h=d.target;if(W(h)){d.stopPropagation();const r=q(h),g=h.getAttribute("data-type")||h.closest(".email-highlight, .code-highlight")?.getAttribute("data-type");if(r){let u;g==="email"?u=`📧 已复制邮箱: ${r}`:g==="code"?u=`🔐 已复制验证码: ${r}`:u=`📋 已复制: ${r}`,P(r,{successMessage:u,errorMessage:"❌ 复制失败，请重试",duration:3e3})}}})}function w(){if(!a||!C.value)return;const i=C.value,d=a.querySelector(".shadow-content");if(!d)return;const h=i.offsetWidth,r=i.offsetHeight,g=d.scrollWidth,u=d.scrollHeight;if(g===0||u===0)return;const A=h/g,M=r/u,D=Math.min(A,M),B=a.host;B.style.zoom=D}return G(()=>{$(),a=x.value.attachShadow({mode:"open"}),t(),w()}),O(()=>b.html,()=>{t(),w()}),(i,d)=>(l(),v("div",{class:"content-box",ref_key:"contentBox",ref:C},[o("div",{ref_key:"container",ref:x,class:"content-html"},null,512)],512))}},St=U(kt,[["__scopeId","data-v-31093c42"]]),bt={class:"box"},Ct={class:"header-actions"},It={key:0,class:"star"},Et={class:"container"},xt={class:"email-title"},$t={class:"content"},Mt={class:"email-info"},Dt={class:"send"},At={class:"send-source"},Bt={class:"send-name"},Ht={class:"send-name-title"},Ft={class:"receive"},Tt={class:"source"},Lt={class:"receive-email"},Nt={class:"date"},Rt=["innerHTML"],jt={key:0,class:"att"},zt={class:"att-title"},Ot={class:"att-box"},Vt=["onClick"],Wt=["onClick"],qt={class:"att-size"},Pt={class:"opt-icon att-icon"},Ut=["href"],Jt={__name:"index",setup(F){const b=Q(),x=X(),C=K(),a=mt(),$=et(),t=a.contentData.email,I=H(!1),w=Z([]),{t:i}=tt();O(()=>C.currentAccountId,()=>{D()});function d(){b.writerRef.openReply(t)}function h(e){return e?JSON.parse(e).message:""}function r(e){e=e||"";const n=x.settings.r2Domain;return console.log(n),e.replace(/{{domain}}/g,lt(n)+"/")}function g(e){if(!u(e))return;const n=j(e);w.length=0,w.push(n),I.value=!0}function u(e){return["png","jpg","jpeg","bmp","gif","jfif"].includes(_t(e))}function A(e){if(!e)return"未知收件人";try{const n=JSON.parse(e);return Array.isArray(n)?n.map(c=>c.address||c.email||c).join(", "):e}catch{return e}}function M(){t.isStar?(t.isStar=0,pt(t.emailId).then(()=>{t.isStar=0,a.cancelStarEmailId=t.emailId,setTimeout(()=>a.cancelStarEmailId=0),a.starScroll?.deleteEmail([t.emailId])}).catch(e=>{console.error(e),t.isStar=1})):(t.isStar=1,gt(t.emailId).then(()=>{t.isStar=1,a.addStarEmailId=t.emailId,setTimeout(()=>a.addStarEmailId=0),a.starScroll?.addItem(t)}).catch(e=>{console.error(e),t.isStar=0}))}const D=()=>{$.back()},B=()=>{wt.confirm(i("delEmailConfirm"),{confirmButtonText:i("confirm"),cancelButtonText:i("cancel"),type:"warning"}).then(()=>{a.contentData.delType==="logic"?ht(t.emailId).then(()=>{z({message:i("delSuccessMsg"),type:"success",plain:!0}),a.deleteIds=[t.emailId]}):vt(t.emailId).then(()=>{z({message:i("delSuccessMsg"),type:"success",plain:!0}),a.deleteIds=[t.emailId]}),$.back()})};function J(e){return e?V(e,{highlightEmails:!0,highlightCodes:!0}):""}function Y(e){const n=e.target;if(W(n)){e.stopPropagation();const c=q(n),E=n.getAttribute("data-type")||n.closest(".email-highlight, .code-highlight")?.getAttribute("data-type");if(c){let k;E==="email"?k=`📧 已复制邮箱: ${c}`:E==="code"?k=`🔐 已复制验证码: ${c}`:k=`📋 已复制: ${c}`,P(c,{successMessage:k,errorMessage:"❌ 复制失败，请重试",duration:3e3})}}}return(e,n)=>{const c=dt,E=ct,k=rt,T=st("perm");return l(),v("div",bt,[o("div",Ct,[S(s(y),{class:"icon",icon:"material-symbols-light:arrow-back-ios-new",width:"20",height:"20",onClick:D}),N(S(s(y),{class:"icon",icon:"uiw:delete",width:"16",height:"16",onClick:B},null,512),[[T,"email:delete"]]),s(a).contentData.showStar?(l(),v("span",It,[s(t).isStar?(l(),f(s(y),{key:0,class:"icon",onClick:M,icon:"fluent-color:star-16",width:"20",height:"20"})):(l(),f(s(y),{key:1,class:"icon",onClick:M,icon:"solar:star-line-duotone",width:"18",height:"18"}))])):_("",!0),s(a).contentData.showReply?N((l(),f(s(y),{key:1,class:"icon",onClick:d,icon:"la:reply",width:"20",height:"20"},null,512)),[[T,"email:send"]]):_("",!0)]),n[1]||(n[1]=o("div",null,null,-1)),S(E,{class:"scrollbar"},{default:R(()=>[o("div",Et,[o("div",xt,m(s(t).subject),1),o("div",$t,[o("div",Mt,[o("div",null,[o("div",Dt,[o("span",At,m(e.$t("from")),1),o("div",Bt,[o("span",Ht,m(s(t).name),1),o("span",null,"<"+m(s(t).sendEmail)+">",1)])]),o("div",Ft,[o("span",Tt,m(e.$t("recipient")),1),o("span",Lt,m(A(s(t).recipient)),1)]),o("div",Nt,[o("div",null,m(s(ut)(s(t).createTime)),1)])]),s(t).status===3?(l(),f(c,{key:0,closable:!1,title:`${e.$t("bounced")} `+h(s(t).message),class:"email-msg",type:"error","show-icon":""},null,8,["title"])):_("",!0),s(t).status===4?(l(),f(c,{key:1,closable:!1,title:e.$t("complained"),class:"email-msg",type:"warning","show-icon":""},null,8,["title"])):_("",!0),s(t).status===5?(l(),f(c,{key:2,closable:!1,title:e.$t("delayed"),class:"email-msg",type:"warning","show-icon":""},null,8,["title"])):_("",!0)]),S(E,{class:ot(["htm-scrollbar",s(t).attList.length===0?"bottom-distance":""])},{default:R(()=>[s(t).content?(l(),f(St,{key:0,class:"shadow-html",html:r(s(t).content)},null,8,["html"])):(l(),v("div",{key:1,class:"email-text",innerHTML:J(s(t).text),onClick:Y},null,8,Rt))]),_:1},8,["class"]),s(t).attList.length>0?(l(),v("div",jt,[o("div",zt,[o("span",null,m(e.$t("attachments")),1),o("span",null,m(e.$t("attCount",{total:s(t).attList.length})),1)]),o("div",Ot,[(l(!0),v(at,null,nt(s(t).attList,p=>(l(),v("div",{class:"att-item",key:p.attId},[o("div",{class:"att-icon",onClick:L=>g(p.key)},[S(s(y),it({ref_for:!0},s(yt)(p.filename)),null,16)],8,Vt),o("div",{class:"att-name",onClick:L=>g(p.key)},m(p.filename),9,Wt),o("div",qt,m(s(ft)(p.size)),1),o("div",Pt,[u(p.filename)?(l(),f(s(y),{key:0,icon:"hugeicons:view",width:"22",height:"22",onClick:L=>g(p.key)},null,8,["onClick"])):_("",!0),o("a",{href:s(j)(p.key),download:""},[S(s(y),{icon:"system-uicons:push-down",width:"22",height:"22"})],8,Ut)])]))),128))])])):_("",!0)])])]),_:1}),I.value?(l(),f(k,{key:0,"url-list":w,"show-progress":"",onClose:n[0]||(n[0]=p=>I.value=!1)},null,8,["url-list"])):_("",!0)])}}},fe=U(Jt,[["__scopeId","data-v-780f12d2"]]);export{fe as default};
