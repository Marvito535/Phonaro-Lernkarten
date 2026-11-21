// rb-mathe.js – reine Rechenfunktionen für den Rechenblock (kein DOM, kein CSS)
//
// Verteilungen (Normal, t, Chi², Binomial, Poisson), Statistik, Formel-Parser,
// Ableitung/Integral/Nullstellen, Gauß-Verfahren, BigInt-Zahlensysteme, Boolesche Ausdrücke.
// Alles hängt am Objekt M und lässt sich auch ohne Browser testen (node).

export const M = {};
M.lgamma=function(x){
  const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(x<0.5) return Math.log(Math.PI/Math.abs(Math.sin(Math.PI*x)))-M.lgamma(1-x);
  x-=1; let a=c[0]; const t=x+g+0.5;
  for(let i=1;i<g+2;i++) a+=c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
};
M.gser=(a,x)=>{let ap=a,sum=1/a,del=sum;for(let n=0;n<1000;n++){ap++;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*1e-16)break;}return sum*Math.exp(-x+a*Math.log(x)-M.lgamma(a));};
M.gcf=(a,x)=>{let b=x+1-a,c=1e300,d=1/b,h=d;for(let i=1;i<1000;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-300)d=1e-300;c=b+an/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<1e-16)break;}return Math.exp(-x+a*Math.log(x)-M.lgamma(a))*h;};
M.gammp=(a,x)=>x<=0?0:(x<a+1?M.gser(a,x):1-M.gcf(a,x));
M.gammq=(a,x)=>x<=0?1:(x<a+1?1-M.gser(a,x):M.gcf(a,x));
M.betacf=(a,b,x)=>{const qab=a+b,qap=a+1,qam=a-1;let c=1,d=1-qab*x/qap;if(Math.abs(d)<1e-300)d=1e-300;d=1/d;let h=d;
  for(let m=1;m<=1000;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<1e-300)d=1e-300;c=1+aa/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;h*=d*c;
  aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<1e-300)d=1e-300;c=1+aa/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<1e-16)break;}return h;};
M.betai=(a,b,x)=>{if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(M.lgamma(a+b)-M.lgamma(a)-M.lgamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*M.betacf(a,b,x)/a:1-bt*M.betacf(b,a,1-x)/b;};
M.erfc=x=>x>=0?M.gammq(0.5,x*x):2-M.gammq(0.5,x*x);
M.normcdf=z=>0.5*M.erfc(-z/Math.SQRT2);
M.normsf=z=>M.normcdf(-z);
M.norminv=p=>{
  if(p<=0)return -Infinity; if(p>=1)return Infinity;
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00],
  b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01],
  c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00],
  d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  let x; const pl=0.02425;
  if(p<pl){const q=Math.sqrt(-2*Math.log(p));x=(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  else if(p>1-pl){const q=Math.sqrt(-2*Math.log(1-p));x=-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  else{const q=p-0.5,r=q*q;x=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
  const e=M.normcdf(x)-p,u=e*Math.sqrt(2*Math.PI)*Math.exp(x*x/2);return x-u/(1+x*u/2);
};
M.tsf=(t,v)=>{const p=0.5*M.betai(v/2,0.5,v/(v+t*t));return t>=0?p:1-p;};
M.tcdf=(t,v)=>1-M.tsf(t,v);
M.invCdf=(cdf,q,lo,hi)=>{
  if(q<=0)return lo; if(q>=1)return hi;
  let a=isFinite(lo)?lo:-1,b=isFinite(hi)?hi:1;
  if(!isFinite(lo)){while(cdf(a)>q&&a>-1e12)a*=2;}
  if(!isFinite(hi)){while(cdf(b)<q&&b<1e12)b=b*2+1;}
  for(let i=0;i<200;i++){const m=(a+b)/2;if(cdf(m)<q)a=m;else b=m;}
  return (a+b)/2;
};
M.tinv=(q,v)=>M.invCdf(x=>M.tcdf(x,v),q,-Infinity,Infinity);
M.factNum=n=>{if(n>=0&&Number.isInteger(n)){if(n>170)return Infinity;let r=1;for(let i=2;i<=n;i++)r*=i;return r;}return Math.exp(M.lgamma(n+1));};
M.factBig=n=>{let r=1n;for(let i=2n;i<=BigInt(n);i++)r*=i;return r;};
M.combBig=(n,k)=>{if(k<0||k>n)return 0n;k=Math.min(k,n-k);let r=1n;for(let i=1;i<=k;i++)r=r*BigInt(n-k+i)/BigInt(i);return r;};
M.permBig=(n,k)=>{if(k<0||k>n)return 0n;let r=1n;for(let i=0;i<k;i++)r*=BigInt(n-i);return r;};
M.binomPmf=(k,n,p)=>{if(k<0||k>n)return 0;if(p===0)return k===0?1:0;if(p===1)return k===n?1:0;return Math.exp(M.lgamma(n+1)-M.lgamma(k+1)-M.lgamma(n-k+1)+k*Math.log(p)+(n-k)*Math.log(1-p));};
M.poisPmf=(k,l)=>{if(k<0)return 0;if(l===0)return k===0?1:0;return Math.exp(-l+k*Math.log(l)-M.lgamma(k+1));};
M.quant=(s,p)=>{const h=(s.length-1)*p,l=Math.floor(h);return s[l]+(h-l)*((l+1<s.length?s[l+1]:s[l])-s[l]);};
M.desc=a=>{
  const n=a.length,s=[...a].sort((x,y)=>x-y),sum=a.reduce((x,y)=>x+y,0),mean=sum/n;
  let m2=0,m3=0,m4=0;for(const v of a){const d=v-mean;m2+=d*d;m3+=d*d*d;m4+=d*d*d*d;}
  const varS=n>1?m2/(n-1):NaN,varP=m2/n,sd=Math.sqrt(varS),sdP=Math.sqrt(varP);
  const cnt=new Map();for(const v of a)cnt.set(v,(cnt.get(v)||0)+1);
  let mx=0;for(const c of cnt.values())mx=Math.max(mx,c);
  const modes=mx>1?[...cnt].filter(e=>e[1]===mx).map(e=>e[0]).sort((x,y)=>x-y):[];
  const q1=M.quant(s,0.25),q3=M.quant(s,0.75);
  return {n,s,sum,mean,median:M.quant(s,0.5),modes,mx,min:s[0],max:s[n-1],range:s[n-1]-s[0],q1,q3,iqr:q3-q1,varS,varP,sd,sdP,
    cv:sd/mean,se:sd/Math.sqrt(n),skew:m2>0?(m3/n)/Math.pow(m2/n,1.5):NaN,kurt:m2>0?(m4/n)/((m2/n)*(m2/n))-3:NaN};
};
M.reg=(xs,ys)=>{
  const n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
  let sxx=0,syy=0,sxy=0;for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
  const b=sxy/sxx,a=my-b*mx,r=sxy/Math.sqrt(sxx*syy);
  return {n,mx,my,b,a,r,r2:r*r,cov:sxy/(n-1),covP:sxy/n,sxx,syy,sxy};
};
M.compile=function(src){
  const s=src.replace(/,/g,'.').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/√/g,'sqrt').replace(/π/g,'pi').replace(/²/g,'^2').replace(/³/g,'^3');
  const toks=[],re=/\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z_0-9]*)|(\S))/gy;
  let m;re.lastIndex=0;
  while(re.lastIndex<s.length&&(m=re.exec(s))){
    if(m[1]!==undefined)toks.push({t:'n',v:parseFloat(m[1])});
    else if(m[2]!==undefined)toks.push({t:'i',v:m[2]});
    else toks.push({t:'o',v:m[3]});
  }
  if(!toks.length)throw new Error('leer');
  let i=0;const pk=()=>toks[i],nx=()=>toks[i++];
  const F={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,sqrt:Math.sqrt,cbrt:Math.cbrt,ln:Math.log,log:Math.log10,lg:Math.log10,log2:Math.log2,exp:Math.exp,abs:Math.abs,floor:Math.floor,ceil:Math.ceil,round:Math.round,sign:Math.sign,fact:M.factNum,gamma:x=>Math.exp(M.lgamma(x))};
  const C={pi:Math.PI,e:Math.E,tau:2*Math.PI,phi:(1+Math.sqrt(5))/2};
  const isO=(t,v)=>t&&t.t==='o'&&t.v===v;
  const starts=t=>t&&(t.t==='n'||t.t==='i'||isO(t,'('));
  function expr(){let l=term();while(isO(pk(),'+')||isO(pk(),'-')){const o=nx().v,r=term(),a=l;l=o==='+'?(e=>a(e)+r(e)):(e=>a(e)-r(e));}return l;}
  function term(){let l=unary();for(;;){const t=pk();
    if(isO(t,'*')||isO(t,'/')){nx();const r=unary(),a=l;l=t.v==='*'?(e=>a(e)*r(e)):(e=>a(e)/r(e));}
    else if(starts(t)){const r=unary(),a=l;l=e=>a(e)*r(e);}
    else break;}return l;}
  function unary(){if(isO(pk(),'-')){nx();const a=unary();return e=>-a(e);}if(isO(pk(),'+')){nx();return unary();}return power();}
  function power(){const b=post();if(isO(pk(),'^')){nx();const x=unary();return e=>Math.pow(b(e),x(e));}return b;}
  function post(){let p=primary();while(isO(pk(),'!')){nx();const a=p;p=e=>M.factNum(a(e));}return p;}
  function primary(){
    const t=nx();if(!t)throw new Error('Ausdruck unvollständig');
    if(t.t==='n'){const v=t.v;return()=>v;}
    if(t.t==='i'){
      const name=t.v;
      if(F[name]){if(!isO(pk(),'('))throw new Error(name+' braucht Klammern, z. B. '+name+'(x)');nx();const a=expr();if(!isO(nx(),')'))throw new Error('Klammer ) fehlt');const f=F[name];return e=>f(a(e));}
      if(name in C){const v=C[name];return()=>v;}
      return e=>{if(!(name in e))throw new Error('Unbekannt: '+name);return e[name];};
    }
    if(isO(t,'(')){const a=expr();if(!isO(nx(),')'))throw new Error('Klammer ) fehlt');return a;}
    throw new Error('Unerwartetes Zeichen „'+t.v+'“');
  }
  const f=expr();
  if(i<toks.length)throw new Error('Unerwartet: „'+toks[i].v+'“');
  return f;
};
M.fn=src=>{const f=M.compile(src);return x=>f({x});};
M.deriv=(f,x)=>{const h=1e-3*Math.max(1,Math.abs(x));return (8*(f(x+h)-f(x-h))-(f(x+2*h)-f(x-2*h)))/(12*h);};
M.deriv2=(f,x)=>{const h=1e-2*Math.max(1,Math.abs(x));return (-f(x+2*h)+16*f(x+h)-30*f(x)+16*f(x-h)-f(x-2*h))/(12*h*h);};
M.simpson=(f,a,b,n=2000)=>{if(a===b)return 0;const h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=f(a+i*h)*(i%2?4:2);return s*h/3;};
M.roots=(f,a,b)=>{
  const out=[],N=4000,h=(b-a)/N;let x0=a,y0=f(a);
  if(y0===0)out.push(a);
  for(let i=1;i<=N;i++){const x1=a+i*h,y1=f(x1);
    if(y1===0&&x1!==a){out.push(x1);}
    else if(Number.isFinite(y0)&&Number.isFinite(y1)&&y0*y1<0){let lo=x0,hi=x1,flo=y0;for(let k=0;k<100;k++){const m=(lo+hi)/2,fm=f(m);if(fm*flo<=0)hi=m;else{lo=m;flo=fm;}}
      const r=(lo+hi)/2;if(Math.abs(f(r))<1e-3*Math.max(1,Math.abs(y0),Math.abs(y1)))out.push(r);}
    x0=x1;y0=y1;if(out.length>=12)break;}
  return out;
};
M.rref=(a,cols)=>{
  const m=a.map(r=>r.slice()),R=m.length;let r=0,det=1;const piv=[];
  for(let c=0;c<cols&&r<R;c++){
    let p=r;for(let i=r+1;i<R;i++)if(Math.abs(m[i][c])>Math.abs(m[p][c]))p=i;
    if(Math.abs(m[p][c])<1e-12){det=0;continue;}
    if(p!==r){const t=m[p];m[p]=m[r];m[r]=t;det=-det;}
    const d=m[r][c];det*=d;for(let j=0;j<m[r].length;j++)m[r][j]/=d;
    for(let i=0;i<R;i++)if(i!==r){const f=m[i][c];if(f!==0)for(let j=0;j<m[i].length;j++)m[i][j]-=f*m[r][j];}
    piv.push(c);r++;
  }
  return {m,piv,det:(piv.length===cols&&cols===R)?det:0};
};
M.parseBig=(s,base)=>{
  s=s.trim().replace(/[\s_]/g,'').toLowerCase();let neg=false;
  if(s[0]==='-'){neg=true;s=s.slice(1);}else if(s[0]==='+')s=s.slice(1);
  if(base===16&&s.startsWith('0x'))s=s.slice(2);
  if(base===2&&s.startsWith('0b'))s=s.slice(2);
  if(base===8&&s.startsWith('0o'))s=s.slice(2);
  if(!s)throw new Error('leer');
  let v=0n;const B=BigInt(base);
  for(const ch of s){const d=parseInt(ch,36);if(Number.isNaN(d)||d>=base)throw new Error('Ungültige Ziffer „'+ch+'“ für Basis '+base);v=v*B+BigInt(d);}
  return neg?-v:v;
};
M.bool=src=>{
  const s=src.replace(/<->|<=>|↔|⇔/g,'≡').replace(/->|=>|→|⇒/g,'>').replace(/∧|&&|&/g,'&').replace(/∨|\|\||\|/g,'|').replace(/⊕|\^/g,'^').replace(/¬|~|!/g,'!')
    .replace(/\bAND\b/gi,'&').replace(/\bOR\b/gi,'|').replace(/\bXOR\b/gi,'^').replace(/\bNOT\b/gi,'!').replace(/\bTRUE\b/gi,'1').replace(/\bFALSE\b/gi,'0');
  const toks=[],re=/\s*([A-Za-z_][A-Za-z_0-9]*|[01]|[()!&|^>≡])/gy;let m;re.lastIndex=0;
  while(re.lastIndex<s.length&&(m=re.exec(s)))toks.push(m[1]);
  if(re.lastIndex<s.trimEnd().length)throw new Error('Unbekanntes Zeichen im Ausdruck');
  if(!toks.length)throw new Error('leer');
  let i=0;const vars=new Set();
  const OPS='()!&|^>≡';
  function eqv(){let l=imp();while(toks[i]==='≡'){i++;const r=imp(),a=l;l=e=>a(e)===r(e)?1:0;}return l;}
  function imp(){const l=or();if(toks[i]==='>'){i++;const r=imp();return e=>(!l(e)||r(e))?1:0;}return l;}
  function or(){let l=xor();while(toks[i]==='|'){i++;const r=xor(),a=l;l=e=>(a(e)||r(e))?1:0;}return l;}
  function xor(){let l=and();while(toks[i]==='^'){i++;const r=and(),a=l;l=e=>(a(e)!==r(e))?1:0;}return l;}
  function and(){let l=not();while(toks[i]==='&'){i++;const r=not(),a=l;l=e=>(a(e)&&r(e))?1:0;}return l;}
  function not(){if(toks[i]==='!'){i++;const a=not();return e=>a(e)?0:1;}return atom();}
  function atom(){const t=toks[i++];if(t===undefined)throw new Error('Ausdruck unvollständig');
    if(t==='('){const a=eqv();if(toks[i++]!==')')throw new Error('Klammer ) fehlt');return a;}
    if(t==='0')return()=>0;if(t==='1')return()=>1;
    if(OPS.includes(t))throw new Error('Unerwartet: „'+t+'“');
    vars.add(t);return e=>e[t]?1:0;}
  const f=eqv();
  if(i<toks.length)throw new Error('Unerwartet: „'+toks[i]+'“');
  return {f,vars:[...vars].sort()};
};

export default M;
