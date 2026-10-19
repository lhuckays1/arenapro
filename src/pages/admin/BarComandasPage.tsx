import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Beer, CheckCircle2, ClipboardList, Pencil, Power, Plus, RefreshCw, Search, ShoppingBag, Trash2, X, Wallet } from 'lucide-react';

type Product = { id: string; name: string; category: string; price: number; active: boolean };
type Court = { id: string; name: string };
type Reservation = { id: string; start_at: string; end_at: string; customer_id: string; court_id: string; customer?: { full_name: string } | null; court?: { name: string } | null };
type Tab = { id: string; tab_number: number; customer_name: string; reservation_id: string | null; court_id: string | null; status: 'OPEN'|'CLOSED'|'CANCELLED'; total_amount: number; paid_amount: number; created_at: string; notes: string | null; court?: { name: string } | null; items?: Item[] };
type Item = { id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; subtotal: number };
type PaymentMethod = 'PIX'|'CASH'|'DEBIT_CARD'|'CREDIT_CARD'|'BANK_TRANSFER'|'OTHER';
const money = (n: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
// Em HTTP na rede local, crypto.randomUUID pode não existir. Mantemos uma chave UUID
// para idempotência sem bloquear o registro do pagamento.
const createRequestUuid = (): string => {
  const cryptoObj = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof cryptoObj?.randomUUID === 'function') return cryptoObj.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const methods: {value:PaymentMethod;label:string}[] = [{value:'PIX',label:'PIX'},{value:'CASH',label:'Dinheiro'},{value:'DEBIT_CARD',label:'Cartão de débito'},{value:'CREDIT_CARD',label:'Cartão de crédito'},{value:'BANK_TRANSFER',label:'Transferência / TED'},{value:'OTHER',label:'Outro'}];

export const BarComandasPage: React.FC<{onNavigate:(path:string)=>void}> = () => {
  const { activeArena, user } = useAuth();
  const [products,setProducts] = useState<Product[]>([]);
  const [tabs,setTabs] = useState<Tab[]>([]);
  const [courts,setCourts] = useState<Court[]>([]);
  const [reservations,setReservations] = useState<Reservation[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [tabFilter,setTabFilter] = useState<'OPEN'|'CLOSED'|'ALL'>('OPEN');
  const [screen,setScreen] = useState<'pdv'|'products'|'commands'>('pdv');
  const [search,setSearch] = useState('');
  const [showProductForm,setShowProductForm] = useState(false);
  const [editingProduct,setEditingProduct] = useState<Product|null>(null);
  const [productToDelete,setProductToDelete] = useState<Product|null>(null);
  const [tabToDelete,setTabToDelete] = useState<Tab|null>(null);
  const [productSearch,setProductSearch] = useState('');
  const [productListSearch,setProductListSearch] = useState('');
  const [productName,setProductName] = useState('');
  const [productCategory,setProductCategory] = useState('Bebidas');
  const [productPrice,setProductPrice] = useState('');
  const [editingTab,setEditingTab] = useState<Tab|null>(null);
  const [customerName,setCustomerName] = useState('');
  const [reservationId,setReservationId] = useState('');
  const [courtId,setCourtId] = useState('');
  const [tabNotes,setTabNotes] = useState('');
  const [itemProductId,setItemProductId] = useState('');
  const [itemQty,setItemQty] = useState('1');
  const [paymentAmount,setPaymentAmount] = useState('');
  const [paymentMethod,setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [paymentNotes,setPaymentNotes] = useState('');
  const [busy,setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeArena) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [p,t,c,r] = await Promise.all([
        supabase.from('bar_products').select('id,name,category,price,active').eq('arena_id',activeArena.id).order('name'),
        supabase.from('bar_tabs').select('id,tab_number,customer_name,reservation_id,court_id,status,total_amount,paid_amount,created_at,notes,court:courts(name)').eq('arena_id',activeArena.id).order('created_at',{ascending:false}).limit(100),
        supabase.from('courts').select('id,name').eq('arena_id',activeArena.id).order('name'),
        supabase.from('reservations').select('id,start_at,end_at,customer_id,court_id,customer:customers(full_name),court:courts(name)').eq('arena_id',activeArena.id).in('status',['PENDING','CONFIRMED']).order('start_at',{ascending:false}).limit(100),
      ]);
      for (const result of [p,t,c,r]) if (result.error) throw result.error;
      setProducts((p.data||[]) as Product[]); setTabs((t.data||[]) as Tab[]); setCourts((c.data||[]) as Court[]); setReservations((r.data||[]) as Reservation[]);
    } catch (e:any) { setError(e?.message || 'Não foi possível carregar as comandas. Execute a migração SQL do módulo Bar no Supabase.'); }
    finally { setLoading(false); }
  },[activeArena]);
  useEffect(()=>{ void load(); },[load]);

  const filteredTabs = useMemo(()=>tabs.filter(t=>(tabFilter==='ALL'||t.status===tabFilter)&&(`${t.customer_name} ${t.tab_number} ${t.court?.name||''}`).toLowerCase().includes(search.toLowerCase())),[tabs,tabFilter,search]);
  const selectedProduct = products.find(p=>p.id===itemProductId);
  const selectedReservation = reservations.find(r=>r.id===reservationId);

  const resetProductForm = () => {
    setEditingProduct(null); setProductName(''); setProductCategory('Bebidas'); setProductPrice('');
    setShowProductForm(false); setError('');
  };

  const openProductCreate = () => {
    setEditingProduct(null); setProductName(''); setProductCategory('Bebidas'); setProductPrice('');
    setError(''); setShowProductForm(true);
  };

  const startEditProduct = (p:Product) => {
    setEditingProduct(p); setProductName(p.name); setProductCategory(p.category || 'Geral');
    setProductPrice(String(p.price)); setError(''); setShowProductForm(true);
  };

  const createProduct = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!activeArena || !productName.trim()) return;
    const price=Number(productPrice.replace(',','.'));
    if(!Number.isFinite(price)||price<0){setError('Informe um preço válido.');return;}
    setBusy(true);setError('');
    const payload={name:productName.trim(),category:productCategory.trim()||'Geral',price,updated_at:new Date().toISOString()};
    const result=editingProduct
      ? await supabase.from('bar_products').update(payload).eq('id',editingProduct.id).eq('arena_id',activeArena.id)
      : await supabase.from('bar_products').insert({...payload,arena_id:activeArena.id,created_by:user?.id||null});
    setBusy(false);
    if(result.error){setError(result.error.code==='23505'?'Já existe um produto com esse nome nesta arena.':result.error.message);return;}
    const edited=!!editingProduct; resetProductForm();
    setNotice(edited?'Produto atualizado com sucesso.':'Produto cadastrado com sucesso.'); await load();
  };

  const deleteProduct = async (p:Product) => {
    if(!activeArena)return;
    setBusy(true);setError('');
    const {error:err}=await supabase.from('bar_products').delete().eq('id',p.id).eq('arena_id',activeArena.id);
    setBusy(false);
    if(err){setError(err.message);return;}
    setProductToDelete(null);setNotice(`Produto "${p.name}" excluído. Vendas já registradas mantêm o histórico.`);
    await load();
  };

  const deleteTab = async (t:Tab) => {
    if(!activeArena)return;
    setBusy(true);setError('');
    const {data:payments,error:payErr}=await supabase.from('bar_tab_payments').select('id').eq('arena_id',activeArena.id).eq('tab_id',t.id).limit(1);
    if(payErr){setBusy(false);setError(payErr.message);return;}
    if((payments||[]).length||Number(t.paid_amount)>0){setBusy(false);setError('Esta comanda possui recebimentos e não pode ser excluída, para preservar o histórico financeiro.');setTabToDelete(null);return;}
    const {error:delErr}=await supabase.from('bar_tabs').delete().eq('id',t.id).eq('arena_id',activeArena.id).eq('status','OPEN');
    setBusy(false);
    if(delErr){setError(delErr.message);return;}
    if(editingTab?.id===t.id)setEditingTab(null);
    setTabToDelete(null);setNotice(`Comanda #${t.tab_number} excluída.`);await load();
  };


  const openTab = async (e:React.FormEvent) => {
    e.preventDefault();if(!activeArena)return;
    const name=(selectedReservation?.customer?.full_name||customerName).trim();
    if(!name){setError('Informe o nome do cliente ou selecione uma reserva.');return;}
    setBusy(true);setError('');
    const {data,error:err}=await supabase.from('bar_tabs').insert({arena_id:activeArena.id,customer_name:name,reservation_id:reservationId||null,court_id:reservationId?(selectedReservation?.court_id||null):(courtId||null),notes:tabNotes.trim()||null,opened_by:user?.id||null}).select('id').single();
    setBusy(false);if(err){setError(err.message);return;}
    setCustomerName('');setReservationId('');setCourtId('');setTabNotes('');setNotice('Comanda aberta com sucesso.');await load();
    const opened=(await supabase.from('bar_tabs').select('id,tab_number,customer_name,reservation_id,court_id,status,total_amount,paid_amount,created_at,notes,court:courts(name)').eq('id',data.id).single()).data as Tab|null;
    if(opened)setEditingTab(opened);
  };

  const addItem = async (e:React.FormEvent) => {
    e.preventDefault();if(!activeArena||!editingTab||!selectedProduct)return;
    const qty=Math.floor(Number(itemQty));if(!Number.isInteger(qty)||qty<1){setError('Informe uma quantidade válida.');return;}
    setBusy(true);setError('');
    const {error:err}=await supabase.from('bar_tab_items').insert({arena_id:activeArena.id,tab_id:editingTab.id,product_id:selectedProduct.id,product_name:selectedProduct.name,quantity:qty,unit_price:selectedProduct.price});
    setBusy(false);if(err){setError(err.message);return;}setItemQty('1');setItemProductId('');await loadTab(editingTab.id);
  };

  const loadTab = async (id:string) => {
    const [tabResult,itemResult]=await Promise.all([
      supabase.from('bar_tabs').select('id,tab_number,customer_name,reservation_id,court_id,status,total_amount,paid_amount,created_at,notes,court:courts(name)').eq('id',id).single(),
      supabase.from('bar_tab_items').select('id,product_id,product_name,quantity,unit_price,subtotal').eq('tab_id',id).order('created_at'),
    ]);
    if(tabResult.error){setError(tabResult.error.message);return;}
    setEditingTab({...tabResult.data,items:(itemResult.data||[]) as Item[]} as Tab);
    setTabs(prev=>prev.map(t=>t.id===id?{...t,...tabResult.data}:t));
  };

  const removeItem = async (item:Item) => {
    if(!editingTab||editingTab.status!=='OPEN')return;
    setBusy(true);const {error:err}=await supabase.from('bar_tab_items').delete().eq('id',item.id).eq('tab_id',editingTab.id);setBusy(false);
    if(err){setError(err.message);return;}await loadTab(editingTab.id);
  };

  const payTab = async (e:React.FormEvent) => {
    e.preventDefault();if(!editingTab||!activeArena)return;
    const amount=Number(paymentAmount.replace(',','.'));
    const balance=Number(editingTab.total_amount)-Number(editingTab.paid_amount);
    if(!Number.isFinite(amount)||amount<=0||amount>balance+0.001){setError(`Informe um valor entre R$ 0,01 e ${money(balance)}.`);return;}
    setBusy(true);setError('');
    const requestKey=createRequestUuid();
    const {error:err}=await supabase.rpc('register_bar_tab_payment',{p_tab_id:editingTab.id,p_amount:amount,p_payment_method:paymentMethod,p_request_key:requestKey,p_notes:paymentNotes.trim()||null});
    setBusy(false);if(err){setError(err.message);return;}
    setPaymentAmount('');setPaymentNotes('');setNotice('Pagamento registrado e lançado no financeiro uma única vez.');await load();await loadTab(editingTab.id);
  };

  const closeWithoutPayment = async () => {
    setError('Para encerrar uma comanda, registre o pagamento do saldo. Comandas pagas integralmente são encerradas automaticamente.');
  };

  if(!activeArena)return <div className="p-8 text-slate-400">Selecione uma arena para acessar o bar.</div>;
  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div><div className="flex items-center gap-2"><div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center"><Beer className="w-5 h-5"/></div><div><h1 className="text-2xl font-black text-white">Bar / Comandas</h1><p className="text-sm text-slate-400">Produtos, consumo e recebimentos da arena</p></div></div></div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>setScreen('products')} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4"/> Produtos</button><button onClick={()=>{setScreen('pdv');setEditingTab(null);setError('');}} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> Nova comanda</button><button onClick={()=>void load()} className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300" title="Atualizar"><RefreshCw className="w-4 h-4"/></button></div>
    </div>
    {error&&<div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/><span>{error}</span><button className="ml-auto" onClick={()=>setError('')}><X className="w-4 h-4"/></button></div>}
    {notice&&<div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4"/><span>{notice}</span><button className="ml-auto" onClick={()=>setNotice('')}><X className="w-4 h-4"/></button></div>}
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2">
      <button onClick={()=>setScreen('pdv')} className={`rounded-xl px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 ${screen==='pdv'?'bg-emerald-500 text-slate-950':'text-slate-300 hover:bg-slate-800'}`}><Plus className="w-4 h-4"/> PDV / Nova comanda</button>
      <button onClick={()=>setScreen('commands')} className={`rounded-xl px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 ${screen==='commands'?'bg-emerald-500 text-slate-950':'text-slate-300 hover:bg-slate-800'}`}><ClipboardList className="w-4 h-4"/> Comandas</button>
      <button onClick={()=>setScreen('products')} className={`rounded-xl px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 ${screen==='products'?'bg-emerald-500 text-slate-950':'text-slate-300 hover:bg-slate-800'}`}><ShoppingBag className="w-4 h-4"/> Produtos</button>
    </div>
    {screen==='products'&&<div className="space-y-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-bold text-white">Produtos cadastrados</h2><p className="text-xs text-slate-400">Gerencie nome, categoria, preço e disponibilidade.</p></div><button type="button" onClick={openProductCreate} className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold">+ Cadastrar produto</button></div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500"/>
        <input value={productListSearch} onChange={e=>setProductListSearch(e.target.value)} placeholder="Buscar produto por nome ou categoria..." className="w-full rounded-xl bg-slate-950 border border-slate-700 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500"/>
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {products.filter(p=>`${p.name} ${p.category}`.toLocaleLowerCase('pt-BR').includes(productListSearch.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(p=>
          <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white truncate">{p.name}</p>
              <p className="text-xs text-slate-400">{p.category || 'Geral'} · <span className="text-emerald-300 font-bold">{money(Number(p.price))}</span></p>
            </div>
            <span className={`text-xs font-semibold ${p.active?'text-emerald-400':'text-rose-400'}`}>{p.active?'Ativo':'Inativo'}</span>
            <div className="col-span-2 sm:col-span-1 flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={()=>startEditProduct(p)}
                title={`Editar ${p.name}`}
                aria-label={`Editar ${p.name}`}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
              ><Pencil className="h-3.5 w-3.5" aria-hidden="true"/><span>Editar</span></button>
              <button
                type="button"
                onClick={async()=>{const {error:err}=await supabase.from('bar_products').update({active:!p.active,updated_at:new Date().toISOString()}).eq('id',p.id).eq('arena_id',activeArena.id);if(err)setError(err.message);else{setNotice(p.active?'Produto desativado.':'Produto ativado.');await load();}}}
                title={p.active?`Desativar ${p.name}`:`Ativar ${p.name}`}
                aria-label={p.active?`Desativar ${p.name}`:`Ativar ${p.name}`}
                className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 ${p.active?'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-400 hover:bg-amber-500/20 focus:ring-amber-400':'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 focus:ring-emerald-400'}`}
              ><Power className="h-3.5 w-3.5" aria-hidden="true"/><span>{p.active?'Desativar':'Ativar'}</span></button>
              <button
                type="button"
                onClick={()=>setProductToDelete(p)}
                title={`Excluir ${p.name}`}
                aria-label={`Excluir ${p.name}`}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400"
              ><Trash2 className="h-3.5 w-3.5" aria-hidden="true"/><span>Excluir</span></button>
            </div>
          </div>
        )}
        {products.filter(p=>`${p.name} ${p.category}`.toLocaleLowerCase('pt-BR').includes(productListSearch.toLocaleLowerCase('pt-BR'))).length===0&&<p className="text-sm text-slate-500 py-8 text-center">{products.length?'Nenhum produto corresponde à busca.':'Nenhum produto cadastrado.'}</p>}
      </div>
    </div>
    </div>}
    {screen==='pdv'&&<div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-xs text-slate-400">Comandas abertas</p><p className="text-2xl font-black text-white mt-1">{tabs.filter(t=>t.status==='OPEN').length}</p></div><div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-xs text-slate-400">Consumo em aberto</p><p className="text-2xl font-black text-emerald-400 mt-1">{money(tabs.filter(t=>t.status==='OPEN').reduce((s,t)=>s+Number(t.total_amount)-Number(t.paid_amount),0))}</p></div><div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-xs text-slate-400">Produtos ativos</p><p className="text-2xl font-black text-white mt-1">{products.filter(p=>p.active).length}</p></div></div>
    <form id="nova-comanda" onSubmit={openTab} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"><div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-400"/><h2 className="font-bold text-white">Abrir nova comanda</h2></div><p className="text-xs text-slate-400">Você pode abrir uma comanda avulsa ou vinculá-la a uma reserva existente.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="text-xs text-slate-400">Vincular a reserva (opcional)<select value={reservationId} onChange={e=>{setReservationId(e.target.value);const r=reservations.find(x=>x.id===e.target.value);if(r){setCustomerName(r.customer?.full_name||'');setCourtId(r.court_id);}}} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white"><option value="">Comanda avulsa</option>{reservations.map(r=><option key={r.id} value={r.id}>{r.customer?.full_name||'Cliente'} · {r.court?.name||'Quadra'} · {new Date(r.start_at).toLocaleString('pt-BR')}</option>)}</select></label><label className="text-xs text-slate-400">Nome do cliente<input value={customerName} onChange={e=>setCustomerName(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white" placeholder="Ex.: João Silva"/></label><label className="text-xs text-slate-400">Quadra (opcional)<select value={courtId} onChange={e=>setCourtId(e.target.value)} disabled={!!reservationId} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white"><option value="">Sem quadra vinculada</option>{courts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-xs text-slate-400">Observações (opcional)<input value={tabNotes} onChange={e=>setTabNotes(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white" placeholder="Ex.: mesa 4"/></label></div><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold">{busy?'Abrindo...':'Abrir comanda'}</button></form>
    </div>}
    {screen==='commands'&&<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h2 className="font-bold text-white">Comandas</h2><div className="flex flex-wrap gap-2"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente ou número" className="pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"/></div><select value={tabFilter} onChange={e=>setTabFilter(e.target.value as any)} className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"><option value="OPEN">Abertas</option><option value="CLOSED">Fechadas</option><option value="ALL">Todas</option></select></div></div>
      {loading?<div className="py-10 text-center text-slate-500">Carregando comandas...</div>:filteredTabs.length===0?<div className="py-10 text-center text-slate-500">Nenhuma comanda encontrada.</div>:<div className="space-y-2">{filteredTabs.map(t=><div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800"><div><div className="flex items-center gap-2"><span className="font-bold text-white">Comanda #{t.tab_number}</span><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${t.status==='OPEN'?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-300'}`}>{t.status==='OPEN'?'Aberta':t.status==='CLOSED'?'Fechada':'Cancelada'}</span></div><p className="text-sm text-slate-300 mt-1">{t.customer_name}{t.court?.name?` · ${t.court.name}`:''}</p><p className="text-xs text-slate-500 mt-1">{new Date(t.created_at).toLocaleString('pt-BR')} · Pago {money(Number(t.paid_amount))}</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="font-black text-emerald-400">{money(Number(t.total_amount))}</p><p className="text-xs text-amber-300">Saldo {money(Number(t.total_amount)-Number(t.paid_amount))}</p></div><div className="flex gap-2"><button onClick={()=>void loadTab(t.id)} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white">{t.status==='OPEN'?'Gerenciar':'Detalhes'}</button>{t.status==='OPEN'&&<button onClick={()=>setTabToDelete(t)} className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300">Excluir</button>}</div></div></div>)}</div>}
    </div>}
    {showProductForm&&<div className="fixed inset-0 z-[80] bg-black/75 flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)resetProductForm();}}><form onSubmit={createProduct} className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 space-y-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black text-white">{editingProduct?'Editar produto':'Cadastrar produto'}</h2><p className="text-sm text-slate-400">Edite os dados e o preço de venda.</p></div><button type="button" onClick={resetProductForm} className="p-2 rounded-lg bg-slate-800 text-slate-300"><X className="w-4 h-4"/></button></div><label className="block text-sm text-slate-300">Nome<input required maxLength={160} value={productName} onChange={e=>setProductName(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white"/></label><label className="block text-sm text-slate-300">Categoria<input maxLength={80} value={productCategory} onChange={e=>setProductCategory(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white"/></label><label className="block text-sm text-slate-300">Preço de venda (R$)<input required type="number" min="0" step="0.01" value={productPrice} onChange={e=>setProductPrice(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white"/></label><div className="flex justify-end gap-2"><button type="button" onClick={resetProductForm} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200">Cancelar</button><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold">{busy?'Salvando...':editingProduct?'Salvar alterações':'Cadastrar produto'}</button></div></form></div>}
    {productToDelete&&<div className="fixed inset-0 z-[90] bg-black/75 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4"><h2 className="text-lg font-bold text-white">Excluir {productToDelete.name}?</h2><p className="text-sm text-slate-300">O produto será removido do cadastro. Vendas anteriores mantêm o histórico do item e do preço.</p><div className="flex justify-end gap-2"><button onClick={()=>setProductToDelete(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200">Cancelar</button><button disabled={busy} onClick={()=>void deleteProduct(productToDelete)} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold">{busy?'Excluindo...':'Confirmar exclusão'}</button></div></div></div>}
    {tabToDelete&&<div className="fixed inset-0 z-[90] bg-black/75 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4"><h2 className="text-lg font-bold text-white">Excluir comanda #{tabToDelete.tab_number}?</h2><p className="text-sm text-slate-300">Só será possível excluir se não houver recebimentos registrados.</p><div className="flex justify-end gap-2"><button onClick={()=>setTabToDelete(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200">Cancelar</button><button disabled={busy} onClick={()=>void deleteTab(tabToDelete)} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold">{busy?'Excluindo...':'Confirmar exclusão'}</button></div></div></div>}
    {editingTab&&<div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingTab(null);}}><div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-5"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black text-white">Comanda #{editingTab.tab_number}</h2><p className="text-sm text-slate-400">{editingTab.customer_name}{editingTab.court?.name?` · ${editingTab.court.name}`:''}</p></div><button onClick={()=>setEditingTab(null)} className="p-2 rounded-lg bg-slate-800 text-slate-300"><X className="w-4 h-4"/></button></div>
      {editingTab.status==='OPEN'&&<div className="grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2"><div><h3 className="font-bold text-white">PDV · Produtos</h3><p className="text-xs text-slate-400">Toque em um produto para adicionar à comanda.</p></div><span className="text-xs text-slate-500">{products.filter(p=>p.active).length} disponíveis</span></div>
          <input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Buscar produto..." className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-white"/>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {products.filter(p=>p.active&&p.name.toLowerCase().includes(productSearch.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(p=><button type="button" key={p.id} disabled={busy} onClick={async()=>{if(!activeArena)return;setBusy(true);setError('');const {error:err}=await supabase.from('bar_tab_items').insert({arena_id:activeArena.id,tab_id:editingTab.id,product_id:p.id,product_name:p.name,quantity:1,unit_price:p.price});setBusy(false);if(err){setError(err.message);return;}await loadTab(editingTab.id);}} className="min-h-20 text-left p-3 rounded-xl border border-slate-700 bg-slate-900 hover:border-emerald-500 hover:bg-emerald-500/10 transition disabled:opacity-50"><span className="block text-sm font-semibold text-white">{p.name}</span><span className="block text-xs text-slate-400 mt-1">{p.category}</span><span className="block text-sm font-black text-emerald-400 mt-2">{money(Number(p.price))}</span></button>)}
            {products.filter(p=>p.active&&p.name.toLowerCase().includes(productSearch.toLowerCase())).length===0&&<p className="col-span-full text-sm text-slate-500 py-6 text-center">Nenhum produto encontrado.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3"><div><h3 className="font-bold text-white">Comanda atual</h3><p className="text-xs text-slate-400">Itens lançados nesta venda.</p></div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
            {(editingTab.items||[]).length===0?<p className="text-sm text-slate-500 py-8 text-center">Nenhum item lançado.<br/><span className="text-xs">Selecione um produto ao lado para começar.</span></p>:(editingTab.items||[]).map(i=>
              <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 bg-slate-900/70 hover:bg-slate-900">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white break-words">{i.product_name}</p>
                  <p className="text-xs text-slate-400 mt-1">{i.quantity} un. × {money(Number(i.unit_price))}</p>
                  {Number(editingTab.paid_amount)===0&&<button disabled={busy} onClick={()=>void removeItem(i)} className="mt-2 inline-flex text-xs font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50">Remover item</button>}
                </div>
                <div className="text-right self-center">
                  <p className="text-sm font-bold text-emerald-400 whitespace-nowrap">{money(Number(i.subtotal))}</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 pt-3 flex items-center justify-between"><span className="text-sm text-slate-400">Total da venda</span><strong className="text-xl text-white">{money(Number(editingTab.total_amount))}</strong></div>
        </section>
      </div>}
      {editingTab.status!=='OPEN'&&<div className="space-y-2">{(editingTab.items||[]).map(i=><div key={i.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800"><div><p className="text-sm font-semibold text-white">{i.product_name}</p><p className="text-xs text-slate-400">{i.quantity} × {money(Number(i.unit_price))}</p></div><strong className="text-emerald-400">{money(Number(i.subtotal))}</strong></div>)}</div>}
      <div className="grid grid-cols-3 gap-2"><div className="p-3 rounded-xl bg-slate-950"><p className="text-xs text-slate-500">Total</p><p className="font-black text-white">{money(Number(editingTab.total_amount))}</p></div><div className="p-3 rounded-xl bg-slate-950"><p className="text-xs text-slate-500">Pago</p><p className="font-black text-emerald-400">{money(Number(editingTab.paid_amount))}</p></div><div className="p-3 rounded-xl bg-slate-950"><p className="text-xs text-slate-500">Saldo</p><p className="font-black text-amber-300">{money(Number(editingTab.total_amount)-Number(editingTab.paid_amount))}</p></div></div>
      {editingTab.status==='OPEN'&&Number(editingTab.total_amount)>Number(editingTab.paid_amount)&&<form onSubmit={payTab} className="border-t border-slate-800 pt-4 space-y-3"><h3 className="font-bold text-white flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400"/> Registrar recebimento</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs text-slate-400">Valor recebido (R$)<input required type="number" min="0.01" max={(Number(editingTab.total_amount)-Number(editingTab.paid_amount)).toFixed(2)} step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white" placeholder={(Number(editingTab.total_amount)-Number(editingTab.paid_amount)).toFixed(2)}/></label><label className="text-xs text-slate-400">Forma de pagamento<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as PaymentMethod)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white">{methods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label><label className="text-xs text-slate-400 sm:col-span-2">Observações (opcional)<input value={paymentNotes} onChange={e=>setPaymentNotes(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white" placeholder="Ex.: pagamento parcial"/></label></div><div className="flex flex-wrap gap-2"><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm">{busy?'Registrando...':'Confirmar recebimento'}</button><button type="button" onClick={()=>setPaymentAmount((Number(editingTab.total_amount)-Number(editingTab.paid_amount)).toFixed(2))} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm">Preencher saldo total</button><button type="button" onClick={()=>void closeWithoutPayment()} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-sm">Como encerrar?</button></div></form>}
      {editingTab.status==='CLOSED'&&<div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm">Comanda paga e encerrada. O recebimento já foi lançado no financeiro.</div>}
      </div></div>}
  </div>;
};
