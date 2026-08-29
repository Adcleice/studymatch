import React from'react';
import ReactDOM from'react-dom/client';
import App from'./App.jsx';
import ErrorBoundary from'./components/ErrorBoundary.jsx';
import NetworkStatus from'./components/NetworkStatus.jsx';
import{BrandProvider}from'./components/BrandProvider.jsx';
import'./index.css';
import'./a11y.css';
import'./forum-inviting.css';
import'./places-professional.css';
import'./brand-polish.css';
import'./admin-hub.css';

if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}))}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><BrandProvider><NetworkStatus/><App/></BrandProvider></ErrorBoundary></React.StrictMode>);
