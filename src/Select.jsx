import React, {useRef, useState} from 'react';
import * as Primitive from '@radix-ui/react-select';
import {CaretDown, CaretUp, Check} from '@phosphor-icons/react';

// Portal stays inside a native dialog's top layer; keyboard navigation is owned by Radix.
export default function Select({children,onChange,value,defaultValue,name,required,disabled,...props}){
 const trigger=useRef(null),[container,setContainer]=useState(null);
 const options=React.Children.toArray(children).flatMap(child=>child?.type===React.Fragment?React.Children.toArray(child.props.children):[child]).filter(React.isValidElement);
 const placeholder=options.find(o=>o.props.value==='')?.props.children||'请选择';
 return <Primitive.Root value={value} defaultValue={defaultValue} name={name} required={required} disabled={disabled} onValueChange={v=>onChange?.({target:{value:v}})} onOpenChange={open=>{if(open)setContainer(trigger.current?.closest('dialog')||document.body);}}>
  <Primitive.Trigger {...props} ref={trigger} className={'select-trigger '+(props.className||'')}><Primitive.Value placeholder={placeholder}/><Primitive.Icon><CaretDown size={16}/></Primitive.Icon></Primitive.Trigger>
  <Primitive.Portal container={container}><Primitive.Content className="select-menu" position="popper" sideOffset={6} collisionPadding={12} onEscapeKeyDown={e=>e.stopPropagation()}>
   <Primitive.ScrollUpButton className="select-scroll"><CaretUp/></Primitive.ScrollUpButton>
   <Primitive.Viewport className="select-viewport">{options.filter(o=>String(o.props.value)!=='').map(o=><Primitive.Item className="select-option" key={o.props.value} value={String(o.props.value)} disabled={o.props.disabled}><Primitive.ItemText>{o.props.children}</Primitive.ItemText><Primitive.ItemIndicator><Check size={16} weight="bold"/></Primitive.ItemIndicator></Primitive.Item>)}</Primitive.Viewport>
   <Primitive.ScrollDownButton className="select-scroll"><CaretDown/></Primitive.ScrollDownButton>
  </Primitive.Content></Primitive.Portal>
 </Primitive.Root>;
}
