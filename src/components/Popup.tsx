'use client';

import { useRef, type ReactNode } from 'react';

export function Popup({title,trigger,children}:{title:string;trigger:string;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 return <>
  <button type="button" className="button" onClick={()=>dialog.current?.showModal()}>{trigger}</button>
  <dialog ref={dialog} className="popup-dialog" onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}}>
   <div className="popup-content">
    <header className="popup-header"><h2>{title}</h2><button type="button" className="button ghost popup-close" aria-label="Close" onClick={()=>dialog.current?.close()}>×</button></header>
    {children}
   </div>
  </dialog>
 </>;
}
