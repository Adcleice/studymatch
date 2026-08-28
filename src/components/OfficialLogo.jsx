import React from'react';
export default function OfficialLogo({style={},className='',alt='Matchworking',withBackground=true}){const src='/studymatch-mark.svg?v=8';return <img src={src} alt={alt} className={className} style={{display:'block',width:36,height:36,maxWidth:36,maxHeight:36,objectFit:'contain',flex:'0 0 36px',...style}}/>}
