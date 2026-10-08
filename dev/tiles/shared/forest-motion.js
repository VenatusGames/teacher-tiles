/* Subpixel foliage deformation, anchored at the forest floor. One shared GPU texture. */
(()=>{'use strict';
 window.TeacherTilesForestMotion=()=>{
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});if(!gl)return null;
  const sources=[['VERTEX_SHADER','attribute vec2 a;varying vec2 uv;void main(){uv=(a+1.)*.5;gl_Position=vec4(a,0.,1.);}'],['FRAGMENT_SHADER',`precision mediump float;varying vec2 uv;uniform sampler2D plate;uniform float time;uniform float camp;
   void main(){
    vec3 original=texture2D(plate,uv).rgb;
    float height=smoothstep(.17,.91,uv.y);
    float sides=1.-smoothstep(.22,.42,uv.x)+smoothstep(.62,.80,uv.x);
    float canopy=mix(1.,clamp(sides,0.,1.),camp);
    float moon=1.-smoothstep(.40,.75,max(original.r,max(original.g,original.b)));
    float breeze=sin(time*.48+uv.x*9.)*.72+sin(time*.73+uv.y*5.+uv.x*17.)*.28;
    vec2 offset=vec2(breeze*3.0/1600.,sin(time*.59+uv.x*14.)*.65/900.)*height*canopy*moon;
    gl_FragColor=vec4(texture2D(plate,clamp(uv+offset,vec2(.001),vec2(.999))).rgb,1.);
   }`]];
  const shaders=sources.map(([type,source])=>{const s=gl.createShader(gl[type]);gl.shaderSource(s,source);gl.compileShader(s);return s});
  if(shaders.some(s=>!gl.getShaderParameter(s,gl.COMPILE_STATUS)))return null;
  const program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);shaders.forEach(s=>gl.deleteShader(s));if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);const clock=gl.getUniformLocation(program,'time'),mode=gl.getUniformLocation(program,'camp');let image=null,lost=false;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true});
  return {draw(next,t,theme){if(lost)return null;if(image!==next){image=next;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,next)}gl.uniform1f(clock,t);gl.uniform1f(mode,theme==='campfire'?1:0);gl.viewport(0,0,1600,900);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return canvas}};
 };
})();
