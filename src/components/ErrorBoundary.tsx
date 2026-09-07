import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Filet de sécurité global.
 *
 * Sans lui, la moindre exception levée pendant le rendu d'un composant démonte
 * tout l'arbre React : l'utilisateur ne voit qu'une page blanche, sans aucune
 * indication ni moyen de repartir.
 *
 * Note : un ErrorBoundary n'intercepte que les erreurs de rendu. Les erreurs
 * dans un gestionnaire d'événement ou une promesse doivent être gérées sur place
 * (voir le try/catch de AiAssistant).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[CABBA] erreur de rendu non interceptée :', error, info.componentStack);
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
