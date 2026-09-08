import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { track } from '../lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Le serveur borne les métadonnées à 4 Ko : tronquer avant d'envoyer. */
const MAX_REPORT_LENGTH = 500;

function reportRenderError(error: Error, info: ErrorInfo, scope: string): void {
  // track() consulte hasAnalyticsConsent() : sans consentement, rien ne part.
  // L'échec d'envoi est déjà avalé par analytics.ts (« must never interfere »).
  void track('error', {
    scope,
    name: error.name,
    message: error.message.slice(0, MAX_REPORT_LENGTH),
    componentStack: (info.componentStack ?? '').slice(0, MAX_REPORT_LENGTH),
  });
}

/**
 * Filet de sécurité global (monté dans main.tsx).
 *
 * Sans lui, la moindre exception levée pendant le rendu d'un composant démonte
 * tout l'arbre React : l'utilisateur ne voit qu'une page blanche, sans aucune
 * indication ni moyen de repartir.
 *
 * Note : un ErrorBoundary n'intercepte que les erreurs de rendu. Les erreurs
 * dans un gestionnaire d'événement ou une promesse doivent être gérées sur
 * place (voir les try/catch de AiAssistant et usePushNotifications).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[CABBA] erreur de rendu non interceptée :', error, info.componentStack);
    reportRenderError(error, info, 'app');
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        dir="rtl"
        className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-yellow-500 text-black flex items-center justify-center text-3xl font-bold">
          C
        </div>
        <h1 className="text-lg font-bold">حدث خطأ غير متوقع</h1>
        <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
          نعتذر، واجه التطبيق مشكلة. حاول إعادة التحميل — إذا تكرر الخطأ أبلغ فريق التطوير.
        </p>
        <button
          onClick={this.handleReload}
          className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-400 transition-colors"
        >
          إعادة التحميل
        </button>
        {import.meta.env.DEV && (
          <pre className="mt-2 max-w-full overflow-x-auto text-left text-[10px] text-red-400 bg-zinc-900 border border-zinc-800 rounded-lg p-3" dir="ltr">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}

interface ScreenBoundaryProps {
  children: ReactNode;
  /** Retour à l'accueil : repli quand « réessayer » ne suffit pas. */
  onHome?: () => void;
}

/**
 * Limite par écran, montée dans App.tsx autour du contenu de l'onglet actif
 * (avec `key={activeTab}` pour que changer d'onglet réinitialise l'erreur).
 * Un crash dans UN écran ne démonte plus toute l'application : la coquille
 * (header, navigation, assistant) survit et l'utilisateur peut continuer.
 */
export class ScreenErrorBoundary extends Component<ScreenBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[CABBA] erreur de rendu dans un écran :', error, info.componentStack);
    reportRenderError(error, info, 'screen');
  }

  private handleRetry = (): void => {
    // Remonter l'écran depuis un état propre suffit pour les erreurs
    // transitoires (donnée API malformée ponctuelle, race de démontage…).
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div dir="rtl" className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-2xl font-bold">
          !
        </div>
        <div>
          <h2 className="text-base font-bold text-white mb-1">تعذر تحميل هذا القسم</h2>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
            حدث خطأ في هذه الشاشة فقط. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={this.handleRetry}
            className="bg-yellow-500 text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-yellow-400 transition-colors"
          >
            إعادة المحاولة
          </button>
          {this.props.onHome && (
            <button
              onClick={this.props.onHome}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              الرئيسية
            </button>
          )}
        </div>
        {import.meta.env.DEV && (
          <pre className="max-w-full overflow-x-auto text-left text-[10px] text-red-400 bg-zinc-900 border border-zinc-800 rounded-lg p-3" dir="ltr">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}
