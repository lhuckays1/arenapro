import React, { useState } from 'react';
import { runStage5IntegrityTests, TestResult } from '../services/stage5-tests';
import { 
  CheckCircle2, 
  XCircle, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  Check, 
  AlertTriangle,
  Layers,
  Activity
} from 'lucide-react';

interface DiagnosticTestsModalProps {
  arenaId: string;
  arenaName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticTestsModal: React.FC<DiagnosticTestsModalProps> = ({
  arenaId,
  arenaName,
  isOpen,
  onClose
}) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const res = await runStage5IntegrityTests(arenaId);
      setResults(res);
    } catch (err) {
      console.error('Error running test suite:', err);
    } finally {
      setRunning(false);
    }
  };

  const totalTests = results ? results.length : 11;
  const passedTests = results ? results.filter(r => r.passed).length : 0;
  const failedTests = results ? results.filter(r => !r.passed).length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                Bateria de 11 Testes de Integridade (Etapa 5)
              </h3>
              <p className="text-xs text-slate-400">
                Auditoria de cálculos operacionais, multi-tenancy, ocupação, receita e inteligência de clientes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-200 block">
              Arena em Teste: {arenaName}
            </span>
            <span className="text-[11px] text-slate-400">
              {results ? `${passedTests} de ${totalTests} testes passaram com sucesso` : 'Pronto para executar a validação dos 11 requisitos'}
            </span>
          </div>

          <button
            onClick={handleRunTests}
            disabled={running}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Executando Testes...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{results ? 'Reexecutar Todos os Testes' : 'Executar Bateria de Testes'}</span>
              </>
            )}
          </button>
        </div>

        {/* Results List */}
        {results && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-slate-300">Resultado dos Testes</span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {passedTests} Passaram
                </span>
                {failedTests > 0 && (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {failedTests} Falharam
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {results.map((res) => (
                <div
                  key={res.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    res.passed 
                      ? 'bg-slate-950/60 border-emerald-500/20' 
                      : 'bg-rose-950/30 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">{res.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-800 text-slate-400">
                            {res.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {res.details}
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                      res.passed 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {res.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
