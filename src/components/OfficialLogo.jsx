import React from'react';
export default function OfficialLogo({style={},className='',alt='StudyMatch',withBackground=true}){return <img src="/studymatch-mark.svg?v=5" alt={alt} className={className} style={{display:'block',objectFit:'contain',background:withBackground?'#082A55':'transparent',borderRadius:withBackground?'28%':0,padding:withBackground?'9%':0,boxSizing:'border-box',...style}}/>}
