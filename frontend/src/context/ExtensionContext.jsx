import { createContext, useContext, useState, useEffect } from 'react';

const ExtensionContext = createContext(null);

export function ExtensionProvider({ children }) {
    const [installedExtensions, setInstalledExtensions] = useState(() => {
        const saved = localStorage.getItem('tl_installed_extensions');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('tl_installed_extensions', JSON.stringify(installedExtensions));
    }, [installedExtensions]);

    const installExtension = (id) => {
        if (!installedExtensions.includes(id)) {
            setInstalledExtensions((prev) => [...prev, id]);
        }
    };

    const uninstallExtension = (id) => {
        setInstalledExtensions((prev) => prev.filter((extId) => extId !== id));
    };

    const hasExtension = (id) => {
        return installedExtensions.includes(id);
    };

    return (
        <ExtensionContext.Provider value={{ installedExtensions, installExtension, uninstallExtension, hasExtension }}>
            {children}
        </ExtensionContext.Provider>
    );
}

export function useExtension() {
    const context = useContext(ExtensionContext);
    if (!context) {
        throw new Error('useExtension must be used within an ExtensionProvider');
    }
    return context;
}
