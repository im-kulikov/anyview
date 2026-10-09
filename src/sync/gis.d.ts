/** Минимальные типы Google Identity Services (https://accounts.google.com/gsi/client), только то, что использует src/sync/firebase.ts. */
interface GisCredentialResponse {
  credential?: string;
}
interface GisIdConfiguration {
  client_id: string;
  callback: (r: GisCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}
interface GisButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill';
  locale?: string;
  width?: number;
}
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(c: GisIdConfiguration): void;
        renderButton(parent: HTMLElement, o: GisButtonConfiguration): void;
        disableAutoSelect(): void;
      };
    };
  };
}
