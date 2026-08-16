import React from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
  /** Mensagem exibida no cabeçalho do erro. */
  title?: string
  /** Descrição exibida abaixo do título. */
  description?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary genérico para capturar erros de renderização e evitar que a
 * página inteira fique em branco (tela branca). Exibe uma mensagem amigável com
 * botão para recarregar a página.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    // Recarrega a rota atual forçando uma remontagem limpa
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-800">
              {this.props.title || 'Algo deu errado'}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {this.props.description ||
                'Ocorreu um erro inesperado ao carregar esta tela. Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.'}
            </p>
            {this.state.error && (
              <pre className="text-[10px] text-left text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 max-h-32 overflow-auto">
                {this.state.error.message}
              </pre>
            )}
            <Button
              onClick={this.handleReload}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold"
            >
              <RotateCw className="w-4 h-4 mr-1.5" />
              Recarregar página
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
