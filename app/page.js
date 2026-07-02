"use client"; // optional only if using client components
// import ChatWidget from "./components/ChatWidget";
import dynamic from "next/dynamic";

const ChatWidget = dynamic(() => import("./components/ChatWidget"), {
  ssr: false,
});

export default function RootLayout({ children }) {
  return <ChatWidget companyId={process.env.NEXT_PUBLIC_COMPANY_ID} />;
}
