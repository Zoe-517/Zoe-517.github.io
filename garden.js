// A small decorative meadow, adapted from the supplied Originkit Garden Progress Slider.
// Keeps its seeded plants and curved stems; no progress control is needed here.
(() => {
  const target = document.querySelector('#commentForm .actions');
  if (!target) return;
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag,attrs={}) => {
    const node = document.createElementNS(ns,tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    return node;
  };
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15),t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7),t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r=rng(4242), garden=document.createElement('div');
  garden.className='album-garden'; garden.setAttribute('aria-hidden','true');
  const svg=make('svg',{viewBox:'0 0 480 170',fill:'none',preserveAspectRatio:'xMidYMax meet'});
  svg.append(make('path',{d:'M18 151 Q235 147 462 151',stroke:'#9bab8c','stroke-opacity':'.35','stroke-width':'.7'}));
  for(let i=0;i<62;i++) {
    const x=23+i*7+r()*5,h=12+r()*32,lean=(r()-.5)*24;
    svg.append(make('path',{d:`M${x} 151 Q${x+lean*.25} ${151-h*.65} ${x+lean} ${151-h}`,stroke:i%3?'#95a97c':'#68835c','stroke-width':.8+r()*.8,'stroke-opacity':.3+r()*.35,'stroke-linecap':'round'}));
  }
  for(let i=0;i<16;i++) {
    const x=28+i*27+r()*12,h=38+r()*66,lean=(r()-.5)*16;
    const g=make('g',{'class':'garden-stem',transform:`translate(${x} 151)`});
    g.style.transformOrigin=`${x}px 151px`;g.style.animationDelay=`${-r()*6}s`;g.style.animationDuration=`${5+r()*3}s`;
    const color=i%3?'#82996d':'#687f59';
    g.append(make('path',{d:`M0 0 Q${lean-8} ${-h*.55} ${lean} ${-h}`,stroke:color,'stroke-width':'1.3','stroke-linecap':'round'}));
    for(const [side,f] of [[-1,.36],[1,.57]]) {
      const y=-h*f;
      g.append(make('path',{d:`M${lean*f} ${y} Q${lean*f+side*19} ${y-18} ${lean*f+side*22} ${y-8} Q${lean*f+side*12} ${y+2} ${lean*f} ${y}`,fill:color,'fill-opacity':'.65'}));
    }
    if(i%4===1) {
      const flower=make('g',{transform:`translate(${lean} ${-h})`});
      for(let p=0;p<5;p++) flower.append(make('ellipse',{cx:0,cy:-5,rx:2.5,ry:4.7,fill:i%2?'#e4d9bb':'#c3cbb7',transform:`rotate(${p*72})`}));
      flower.append(make('circle',{r:2.5,fill:'#bba26e'}));g.append(flower);
    }
    svg.append(g);
  }
  garden.append(svg);target.append(garden);
  new IntersectionObserver(entries=>garden.classList.toggle('garden-visible',entries[0].isIntersecting),{threshold:.1}).observe(garden);
})();
