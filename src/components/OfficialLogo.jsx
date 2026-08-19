import React from'react';
export default function OfficialLogo({style={},className='',alt='StudyMatch',withBackground=true}){const src=withBackground?'/studymatch-logo.svg?v=7':'/studymatch-mark.svg?v=7';return <img src={src} alt={alt} className={className} style={{display:'block',width:36,height:36,maxWidth:36,maxHeight:36,objectFit:'contain',flex:'0 0 36px',...style}}/>}
