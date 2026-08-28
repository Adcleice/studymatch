import React from'react';
import ReactDOM from'react-dom/client';
import App from'./App.jsx';
import ErrorBoundary from'./components/ErrorBoundary.jsx';
import NetworkStatus from'./components/NetworkStatus.jsx';
import'./index.css';
import'./a11y.css';

const OLD_NAME='StudyMatch';
const NEW_NAME='Matchworking';
function updateBrand(root){
  if(!root)return;
  if(root.nodeType===3){if(root.nodeValue?.includes(OLD_NAME))root.nodeValue=root.nodeValue.replaceAll(OLD_NAME,NEW_NAME);return}
  if(root.nodeType!==1)return;
  ['alt','title','aria-label'].forEach(attr=>{const value=root.getAttribute?.(attr);if(value?.includes(OLD_NAME))root.setAttribute(attr,value.replaceAll(OLD_NAME,NEW_NAME))});
  root.childNodes?.forEach(updateBrand);
}
const observer=new MutationObserver(changes=>changes.forEach(change=>change.addedNodes.forEach(updateBrand)));
observer.observe(document.documentElement,{childList:true,subtree:true});
document.title=document.title.replaceAll(OLD_NAME,NEW_NAME);

if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}))}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><NetworkStatus/><App/></ErrorBoundary></React.StrictMode>);
