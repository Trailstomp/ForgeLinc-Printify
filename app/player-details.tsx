"use client";
import {useId} from "react";
export default function PlayerDetails({name,number,onName,onNumber,disabled=false,preview=false}:{name:string;number:string;onName:(s:string)=>void;onNumber:(s:string)=>void;disabled?:boolean;preview?:boolean}){
 const id=useId();
 return <fieldset className="player-details" disabled={disabled}><legend>{preview?"Preview player details":"Make it yours"}</legend><label htmlFor={id+"-name"}>Name on back <small>Optional</small></label><input id={id+"-name"} value={name} maxLength={24} placeholder="Your name" autoComplete="off" onChange={e=>onName(e.target.value.replace(/[\u0000-\u001f\u007f]/g,""))}/><label htmlFor={id+"-number"}>Number on left sleeve <small>Optional</small></label><input id={id+"-number"} value={number} maxLength={3} inputMode="numeric" pattern="[0-9]*" placeholder="35" autoComplete="off" onChange={e=>onNumber(e.target.value.replace(/\D/g,"").slice(0,3))}/><p className="fine-print">{preview?"Preview only. Players enter their own name and number in Team Shop.":"Leave either field blank for no name or number. Your choices appear in the preview."}</p></fieldset>;
}
