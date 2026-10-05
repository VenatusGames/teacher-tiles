/* One small GPU surface supplies turbulent, non-repeating flame motion. */
(()=>{'use strict';
 function softwareFlame(){
  const c=document.createElement('canvas');c.width=96;c.height=144;const g=c.getContext('2d'),pixels=g.createImageData(c.width,c.height),grid=new Float32Array(4096);
  for(let i=0;i<grid.length;i++){const v=Math.sin(i*127.1)*43758.5453;grid[i]=v-Math.floor(v)}
  const lerp=(a,b,t)=>a+(b-a)*t;
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const at=(x,y)=>grid[((y&63)*64)+(x&63)];return lerp(lerp(at(ix,iy),at(ix+1,iy),fx),lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy)}
  const smooth=(a,b,v)=>{const x=Math.max(0,Math.min(1,(v-a)/(b-a)));return x*x*(3-2*x)};
  return {draw(t){for(let y=0;y<144;y++)for(let x=0;x<96;x++){
   const yy=1-y/143,xx=x/95*2-1,n=noise(xx*4,yy*4-t*1.5)*.7+noise(xx*9,yy*8-t*2.3)*.3,q=(xx+(n-.5)*(.1+yy*.8))/(1-yy*.57);
   const density=Math.exp(-Math.pow(q*2.9,2))*(1-yy*.7)+(n-.48)*.66-yy*.49,heat=Math.max(0,Math.min(1,density*1.4-yy*.24)),alpha=smooth(.035,.22,density)*smooth(0,.065,yy)*(1-smooth(.85,1,yy))*.86,i=(y*96+x)*4;
   pixels.data[i]=255;pixels.data[i+1]=66+heat*181;pixels.data[i+2]=3+heat*170;pixels.data[i+3]=alpha*255;
  }g.putImageData(pixels,0,0);return c},dispose(){c.width=c.height=1}};
 }

 window.TeacherTilesFlameRenderer=()=>{
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});
  if(!gl)return softwareFlame();
  const vertex='attribute vec2 a; varying vec2 uv; void main(){uv=(a+1.)*.5;gl_Position=vec4(a,0.,1.);}';
  const fragment=`precision mediump float;
   varying vec2 uv;uniform float time;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p+7.3;a*=.5;}return v;}
   void main(){
    float y=uv.y,x=uv.x*2.-1.;
    vec2 flow=vec2(x*3.1,y*3.6-time*.83);
    float curl=fbm(flow+vec2(0.,time*.18));
    float fine=fbm(vec2(x*9.+curl*2.,y*7.-time*1.8));
    float drift=(curl-.5)*(.10+y*.94);
    float xx=(x+drift)/(1.-y*.57);
    float source=.56*exp(-pow((xx+.49)*8.4,2.))+.75*exp(-pow((xx+.25)*8.1,2.))+.92*exp(-pow(xx*7.1,2.))+.69*exp(-pow((xx-.26)*8.2,2.))+.51*exp(-pow((xx-.49)*9.8,2.));
    float rise=source*(1.-y*.70)+(curl-.48)*.56+(fine-.48)*.26-y*.49;
    float mask=smoothstep(.035,.22,rise)*smoothstep(0.,.065,y)*(1.-smoothstep(.85,1.,y));
    mask*=1.-smoothstep(.75,1.,abs(x));
    float heat=clamp(rise*1.4-y*.24,0.,1.);
    vec3 color=mix(vec3(1.,.26,.012),vec3(1.,.66,.065),smoothstep(.06,.40,heat));
    color=mix(color,vec3(1.,.88,.35),smoothstep(.32,.8,heat));
    color=mix(color,vec3(1.,.97,.77),smoothstep(.75,1.,heat));
    gl_FragColor=vec4(color,mask*.86);
   }`;
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null}return shader}
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs)return softwareFlame();
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return softwareFlame();
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const location=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);const clock=gl.getUniformLocation(program,'time');
  let lost=false,fallback=null;canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true});canvas.addEventListener('webglcontextrestored',()=>{lost=true});
  return {draw(t){if(lost){fallback??=softwareFlame();return fallback.draw(t)}gl.viewport(0,0,384,384);gl.uniform1f(clock,t);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return canvas},dispose(){fallback?.dispose();gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}};
 };
})();
