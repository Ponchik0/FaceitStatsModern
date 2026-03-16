// Type definitions for Millennium API
declare namespace Millennium {
    function findElement(document: Document, selector: string): HTMLElement[];
    function callServerMethod(methodName: string, args: any): Promise<any>;
    function version(): string;
    function steam_path(): string;
    function add_browser_css(filename: string): void;
    function ready(): void;
}

declare const MILLENNIUM_BACKEND_IPC: any;
declare const MILLENNIUM_API: any;
declare const MainWindowBrowserManager: any;
declare const SteamClient: any;

interface Window {
    PLUGIN_LIST: any;
    MILLENNIUM_PLUGIN_SETTINGS_STORE: any;
}
