
import { AppHeader } from "@/components/header";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <AppHeader />
            {children}
        </>
    );
}
