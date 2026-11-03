'use client';

import { useRef, type ReactNode } from 'react';

export function Popup({title,trigger,triggerLabel,triggerClassName,onOpen,children}:{title:string;trigger:ReactNode;triggerLabel?:string;triggerClassName?:string;onOpen?:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 return <>
  <button type="button" className={triggerClassName??'button'} aria-label={triggerLabel} title={triggerLabel} onClick={()=>{onOpen?.();dialog.current?.showModal();}}>{trigger}</button>
  <dialog ref={dialog} className="popup-dialog" onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}}>
   <div className="popup-content">
    <header className="popup-header"><h2>{title}</h2><button type="button" className="button ghost popup-close" aria-label="Close" onClick={()=>dialog.current?.close()}>×</button></header>
    {children}
   </div>
  </dialog>
 </>;
}
