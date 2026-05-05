'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
/** When `modal={false}`, Radix does not render `DialogOverlay`; wizards still need a dim layer. */
const DialogModalContext = React.createContext(true);
/**
 * Radix `modal` (default true) runs `hideOthers(dialogContent)` so only the panel stays in the a11y tree.
 * Portaled Select/Dropdown content is a sibling under `body`, so it gets `inert` / `aria-hidden` and stops
 * receiving clicks — wizards then "die" on later steps. Use `modal={false}` on multi-step forms; we add
 * a fallback backdrop and still block outside-dismiss via handlers below.
 */
function Dialog({ modal = true, ...props }) {
    return (<DialogModalContext.Provider value={modal}>
      <DialogPrimitive.Root data-slot="dialog" modal={modal} {...props}/>
    </DialogModalContext.Provider>);
}
function DialogTrigger({ ...props }) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props}/>;
}
function DialogPortal({ ...props }) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props}/>;
}
function DialogClose({ ...props }) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props}/>;
}
function DialogOverlay({ className, ...props }) {
    return (<DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50', className)} {...props}/>);
}
function DialogContent({ className, children, showCloseButton = true, ...props }) {
    const modal = React.useContext(DialogModalContext);
    const { onPointerDownOutside: userOnPointerDownOutside, onInteractOutside: userOnInteractOutside, onFocusOutside: userOnFocusOutside, ...restProps } = props;
    return (<DialogPortal data-slot="dialog-portal">
      {!modal && (<div aria-hidden className="fixed inset-0 z-40 bg-black/50"/>)}
      <DialogOverlay className="z-40"/>
      <DialogPrimitive.Content data-slot="dialog-content" className={cn('bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg', className)} {...restProps} onPointerDownOutside={(e) => {
            userOnPointerDownOutside?.(e);
            if (!e.defaultPrevented)
                e.preventDefault();
        }} onInteractOutside={(e) => {
            userOnInteractOutside?.(e);
            if (!e.defaultPrevented)
                e.preventDefault();
        }} onFocusOutside={(e) => {
            userOnFocusOutside?.(e);
            if (!e.defaultPrevented)
                e.preventDefault();
        }}>
        {children}
        {showCloseButton && (<DialogPrimitive.Close data-slot="dialog-close" className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>)}
      </DialogPrimitive.Content>
    </DialogPortal>);
}
function DialogHeader({ className, ...props }) {
    return (<div data-slot="dialog-header" className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props}/>);
}
function DialogFooter({ className, ...props }) {
    return (<div data-slot="dialog-footer" className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props}/>);
}
function DialogTitle({ className, ...props }) {
    return (<DialogPrimitive.Title data-slot="dialog-title" className={cn('text-lg leading-none font-semibold', className)} {...props}/>);
}
function DialogDescription({ className, ...props }) {
    return (<DialogPrimitive.Description data-slot="dialog-description" className={cn('text-muted-foreground text-sm', className)} {...props}/>);
}
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger, };
