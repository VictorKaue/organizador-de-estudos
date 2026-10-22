import { useState, type FormEvent } from "react";

interface Props {
  rotulo: string;
  placeholder: string;
  aoCriar: (nome: string) => Promise<void>;
}

/** Formulário de uma linha para criar um item pelo nome. */
export function NovoItem({ rotulo, placeholder, aoCriar }: Props) {
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpo = nome.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro(undefined);
    try {
      await aoCriar(limpo);
      setNome("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="novo-item" onSubmit={enviar}>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        maxLength={80}
      />
      <button type="submit" disabled={enviando || !nome.trim()}>
        {rotulo}
      </button>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </form>
  );
}
