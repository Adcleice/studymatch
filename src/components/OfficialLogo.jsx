import React from'react';
export default function OfficialLogo({style={},className='',alt='StudyMatch',withBackground=true}){
  const {width=36,height=36,borderRadius,...rest}=style;
  const radius=borderRadius??(withBackground?11:0);
  return <span className={className} style={{display:'inline-grid',placeItems:'center',flex:'0 0 auto',width,height,minWidth:width,minHeight:height,maxWidth:width,maxHeight:height,overflow:'hidden',background:withBackground?'#082A55':'transparent',borderRadius:radius,boxSizing:'border-box',padding:withBackground?Math.max(3,Math.round(Number(width)*0.12)):0,...rest}}>
    <img src="/studymatch-mark.svg?v=6" alt={alt} style={{display:'block',width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
  </span>
}
