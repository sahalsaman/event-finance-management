import type {Metadata,Viewport} from 'next';import './globals.css';
export const metadata:Metadata={title:'Event Finance',description:'Mobile-first event income and expense tracker',manifest:'/manifest.webmanifest'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#115b3c'};
export const instant=false;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
