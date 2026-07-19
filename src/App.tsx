import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ShoppingBasket,
  ChevronRight,
  Plus,
  Minus,
  CheckCircle,
  MapPin,
  Leaf,
  ArrowLeft,
  MessageCircle,
  Loader2,
  Search,
  X,
  QrCode,
  Share2,
} from "lucide-react";

const SHEET_BASE =
  "https://TROCAR_URL_CSV/pub?output=csv";

const SHEET_URL = SHEET_BASE;
const BANNERS_URL = `${SHEET_BASE}&gid=TROCAR_ID_BANNERS`;
const SETTINGS_URL = `${SHEET_BASE}&gid=TROCAR_ID_SETTINGS`;

const getNextDayDeliverySlots = (): string[] => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(tomorrow);
  const label = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return [`${label} - Manhã (8h - 12h)`, `${label} - Tarde (13h - 18h)`];
};

const DEFAULT_SHIPPING_FEE = 10;
const DEFAULT_MIN_ORDER = 0;

type StoreSettings = {
  shippingFee: number;
  minOrder: number;
};

const parseNumberBR = (value: string | undefined): number => {
  if (!value) return NaN;
  const normalized = value
    .replace(/[R$\s]/gi, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  return parseFloat(normalized);
};

const parseSettingsCSV = (csvData: string): Partial<StoreSettings> => {
  const rows = parseCSV(csvData).slice(1);
  const result: Partial<StoreSettings> = {};

  for (const columns of rows) {
    if (!columns || columns.length < 2) continue;
    const key = (columns[0] || "").trim().toLowerCase();
    const rawValue = (columns[1] || "").trim();
    if (!key || !rawValue) continue;

    const num = parseNumberBR(rawValue);
    if (Number.isNaN(num)) continue;

    if (key === "frete" || key === "shipping_fee" || key === "frete_fixo") {
      result.shippingFee = num;
    } else if (
      key === "pedido_minimo" ||
      key === "pedido_mínimo" ||
      key === "min_order" ||
      key === "minimo"
    ) {
      result.minOrder = num;
    }
  }

  return result;
};

const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    field += c;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const CART_STORAGE_KEY = "pomar:cart:v1";

const loadCartFromStorage = (): Record<string, any> => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const formatCurrencyBRL = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

const formatQty = (qty: number, type: string) => {
  if (type === "unit") return `${qty} un`;
  return qty >= 1 ? `${qty} kg` : `${qty * 1000}g`;
};

const getProductDescription = (product: any): string => {
  const cat = (product?.category || "").toLowerCase();
  if (cat.includes("fruta"))
    return "Fruta fresquinha, colhida no ponto certo direto do produtor. Sabor de verdade, sem intermediários.";
  if (cat.includes("folha"))
    return "Folhas verdes selecionadas no dia, crocantes e cheias de viço. Perfeitas para saladas e refeições do dia a dia.";
  if (cat.includes("legume"))
    return "Legume selecionado, colhido no ponto e entregue fresco no seu apartamento. Direto do produtor para a sua mesa.";
  if (cat.includes("tempero") || cat.includes("erva"))
    return "Tempero fresco e aromático, colhido na hora para realçar o sabor das suas receitas.";
  return "Produto fresquinho selecionado pelo nosso produtor, entregue direto no seu apartamento.";
};

const SuccessView = ({
  setView,
  setCart,
}: {
  setView: React.Dispatch<
    React.SetStateAction<"catalog" | "cart" | "success" | "product">
  >;
  setCart: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in">
    <div className="bg-emerald-50 p-8 sm:p-10 rounded-[3rem] sm:rounded-[4rem] mb-8">
      <CheckCircle size={80} className="text-emerald-500" strokeWidth={3} />
    </div>

    <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-6 tracking-tighter leading-tight">
      Pedido
      <br />
      Enviado!
    </h2>

    <p className="text-slate-500 mb-8 font-medium">
      Pague pelo link de Pix no WhatsApp.
    </p>

    <button
      onClick={() => {
        setView("catalog");
        setCart({});
      }}
      className="bg-slate-900 text-white font-black px-10 py-4 rounded-2xl shadow-xl active:scale-95 transition-transform"
    >
      Novo Pedido
    </button>
  </div>
);

const App = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"catalog" | "cart" | "success" | "product">(
    "catalog",
  );
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productOrigin, setProductOrigin] = useState<"catalog" | "cart">(
    "catalog",
  );
  const [cart, setCart] = useState<Record<string, any>>(() =>
    loadCartFromStorage(),
  );
  const deliverySlots = useMemo(() => getNextDayDeliverySlots(), []);
  const [selectedSlot, setSelectedSlot] = useState(deliverySlots[0]);
  const [settings, setSettings] = useState<StoreSettings>({
    shippingFee: DEFAULT_SHIPPING_FEE,
    minOrder: DEFAULT_MIN_ORDER,
  });
  const [condoName] = useState("TROCAR_ENDERECO");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    apart: "",
    address:
      "TROCAR_ENDERECO",
  });

  const [formErrors, setFormErrors] = useState({
    name: "",
    apart: "",
  });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const apartInputRef = useRef<HTMLInputElement>(null);

  useRegisterSW({
    onRegistered(r) {
      r &&
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000,
        ); // Checa por atualizações a cada hora
    },
  });

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${SHEET_URL}&_=${Date.now()}`, {
        cache: "no-store",
      });
      const csvData = await response.text();

      const rows = parseCSV(csvData).slice(1);

      const parsedProducts = rows
        .map((columns) => {
          if (columns.length < 2) return null;

          const [id, name, price, unitType, step, min, category, image] =
            columns;

          return {
            id: id?.trim(),
            name: name?.trim(),
            price: parseNumberBR(price),
            unitType: unitType?.trim(),
            step: parseFloat(step),
            min: parseFloat(min),
            category: category?.trim() || "Outros",
            image: image?.trim(),
          };
        })
        .filter((p) => p && p.name);

      setProducts(parsedProducts);
      setLoading(false);
    } catch (err) {
      setError("Não foi possível carregar o menu.");
      setLoading(false);
    }
  };

  const fetchBanners = async () => {
    if (BANNERS_URL.includes("BANNERS_GID")) return;
    try {
      const response = await fetch(`${BANNERS_URL}&_=${Date.now()}`, {
        cache: "no-store",
      });
      const csvData = await response.text();
      const rows = parseCSV(csvData).slice(1);

      const parsedBanners = rows
        .map((columns) => {
          if (columns.length < 2) return null;
          const [id, image, link, title] = columns;
          return {
            id: id?.trim(),
            image: image?.trim(),
            link: link?.trim(),
            title: title?.trim(),
          };
        })
        .filter((b: any) => b && b.image);

      setBanners(parsedBanners);
    } catch (err) {
      // Banners são opcionais — falha silenciosa.
    }
  };

  const fetchSettings = async () => {
    if (SETTINGS_URL.includes("SETTINGS_GID")) return;
    try {
      const response = await fetch(`${SETTINGS_URL}&_=${Date.now()}`, {
        cache: "no-store",
      });
      const csvData = await response.text();
      const parsed = parseSettingsCSV(csvData);
      setSettings((prev) => ({
        shippingFee:
          typeof parsed.shippingFee === "number"
            ? parsed.shippingFee
            : prev.shippingFee,
        minOrder:
          typeof parsed.minOrder === "number"
            ? parsed.minOrder
            : prev.minOrder,
      }));
    } catch (err) {
      // Configurações são opcionais — usa os valores padrão.
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
    fetchBanners();
    fetchSettings();

    const interval = setInterval(
      () => {
        fetchProducts();
        fetchBanners();
        fetchSettings();
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage indisponível (modo privado, cota cheia) — ignora.
    }
  }, [cart]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["Todos", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === "Todos" || p.category === selectedCategory;
      const matchesQuery = !q || p.name?.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, searchQuery, selectedCategory]);

  const updateQuantity = (product: any, delta: number) => {
    setCart((prev) => {
      const current = prev[product.id] || { ...product, qty: 0 };
      const newQty = Math.max(0, current.qty + delta * product.step);
      const newCart = { ...prev };

      if (newQty <= 0) {
        delete newCart[product.id];
      } else {
        newCart[product.id] = {
          ...current,
          qty: parseFloat(newQty.toFixed(2)),
        };
      }

      return newCart;
    });
  };

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartSubtotal = cartItems.reduce(
    (acc: number, item: any) => acc + item.price * item.qty,
    0,
  );
  const cartTotal = cartSubtotal > 0 ? cartSubtotal + settings.shippingFee : 0;
  const meetsMinOrder = cartSubtotal >= settings.minOrder;
  const cartCount = cartItems.length;

  const handleInputChange = (field: "name" | "apart", value: string) => {
    setCustomerInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (value.trim() && formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleInputBlur = (field: "name" | "apart") => {
    if (!(customerInfo[field] || "").trim()) {
      setFormErrors((prev) => ({ ...prev, [field]: "Campo obrigatório" }));
    }
  };

  const validateForm = () => {
    const errors = {
      name: "",
      apart: "",
    };

    if (!(customerInfo.name || "").trim()) errors.name = "Campo obrigatório";
    if (!(customerInfo.apart || "").trim()) errors.apart = "Campo obrigatório";

    setFormErrors(errors);

    return !errors.name && !errors.apart;
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const message =
      `🌱 *Pomar no Prédio* — frutas e verduras fresquinhas entregues no ${condoName}!\n\n` +
      `Faça seu pedido pelo link: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleWhatsAppCheckout = () => {
    if (cartItems.length === 0) {
      setView("catalog");
      return;
    }

    const isValid = validateForm();

    if (!isValid) {
      document
        .getElementById("customer-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      const target = !(customerInfo.name || "").trim()
        ? nameInputRef.current
        : apartInputRef.current;
      setTimeout(() => target?.focus({ preventScroll: true }), 350);
      return;
    }

    const phone = "TROCAR_TELEFONE" // incluir 5514 depois o numero;

    let message = `*NOVO PEDIDO*\n\n`;
    message += `*Nome:* ${customerInfo.name}\n`;
    message += `*Local:* ${condoName} - Apt: ${customerInfo.apart}\n`;
    message += `*Endereço:* ${customerInfo.address}\n`;
    message += `*Entrega:* ${selectedSlot}\n`;
    message += `*Pagamento:* Pix\n`;
    message += `--------------------------\n`;

    cartItems.forEach((item: any) => {
      message += `• ${item.name} (${formatQty(item.qty, item.unitType)}) - ${formatCurrencyBRL(
        item.price * item.qty,
      )}\n`;
    });

    message += `--------------------------\n`;
    message += `Subtotal: ${formatCurrencyBRL(cartSubtotal)}\n`;
    message += `Frete: ${formatCurrencyBRL(settings.shippingFee)}\n`;
    message += `*TOTAL: ${formatCurrencyBRL(cartTotal)}*\n\n`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
    setView("success");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-800 text-white p-6 text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <h2 className="text-xl font-bold italic tracking-tight">
          Colhendo informações...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 max-w-md w-full">
          <h2 className="text-xl font-black text-slate-900 mb-2">Ops!</h2>
          <p className="text-slate-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-slate-50 min-h-screen font-sans antialiased text-slate-900 relative border-x border-slate-200">
      {/* ===== CATALOG VIEW ===== */}
      {view === "catalog" && (
        <div className=" bg-slate-50 min-h-screen">
          <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] sm:rounded-b-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 translate-x-1/4 -translate-y-1/4">
              <Leaf size={200} />
            </div>

            <div className="flex justify-between items-center relative z-10">
              <div className="flex flex-col gap-2">
                <img src="logo.png" alt="Pomar no predio" width={150} />
                <span className="inline-flex items-center gap-1.5 self-start bg-white/15 backdrop-blur-sm border border-white/25 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                  <Leaf size={12} strokeWidth={3} />
                  Direto do produtor
                </span>
              </div>

              <button
                onClick={() => setView("cart")}
                className="bg-emerald/10 backdrop-blur-xl p-3 sm:p-4 rounded-2xl relative border border-white/20"
              >
                <ShoppingBasket className="w-6 h-6 text-emerald-500" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-emerald-800">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

            {/* Busca */}
            <div className="relative z-10 mt-6">
              <div className="bg-white rounded-2xl shadow-lg flex items-center gap-2 px-4 py-3">
                <Search size={18} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar frutas, verduras..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-800 placeholder:text-slate-400 min-w-0"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 active:text-slate-600 flex-shrink-0"
                    aria-label="Limpar busca"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Banners */}
          {banners.length > 0 && (
            <div className="mt-6 px-4 sm:px-6">
              <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {banners.map((banner) => {
                  const content = (
                    <img
                      src={banner.image}
                      alt={banner.title || "Banner"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  );
                  return (
                    <div
                      key={banner.id || banner.image}
                      className="snap-start flex-shrink-0 w-[85%] sm:w-[60%] aspect-[16/7] rounded-[1.5rem] overflow-hidden shadow-md bg-slate-200"
                    >
                      {banner.link ? (
                        <a
                          href={banner.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-full"
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categorias */}
          {categories.length > 1 && (
            <div className="mt-6 px-4 sm:px-6">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-colors border ${
                        active
                          ? "bg-emerald-800 text-white border-emerald-800 shadow-md"
                          : "bg-white text-slate-600 border-slate-200 active:bg-slate-100"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-2 sm:p-6 flex flex-wrap gap-3 sm:gap-6 mt-2 justify-center">
            {filteredProducts.length === 0 && (
              <div className="w-full text-center py-12 px-6">
                <p className="text-slate-400 font-bold text-sm">
                  Nenhum produto "{searchQuery}" encontrado na categoria "
                  {selectedCategory}".
                </p>
              </div>
            )}
            {filteredProducts.map((product: any) => {
              const inCart = cart[product.id];
              const openDetail = () => {
                setSelectedProduct(product);
                setProductOrigin("catalog");
                setView("product");
              };

              return (
                <div
                  key={product.id}
                  onClick={openDetail}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail();
                    }
                  }}
                  className="bg-white rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 flex flex-col transition-all hover:shadow-md flex-grow flex-shrink-0 basis-[calc(50%-0.75rem)] min-w-[140px] max-w-[220px] sm:max-w-[280px] cursor-pointer active:scale-[0.98]"
                >
                  <div className="relative aspect-square sm:aspect-video overflow-hidden bg-slate-200">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="p-3 sm:p-4 flex flex-col flex-1">
                    <h3 className="text-[11px] sm:text-sm font-black text-slate-800 leading-tight mb-1 min-h-[2.5rem] line-clamp-2">
                      {product.name}
                    </h3>

                    <div className="flex items-center sm:flex-row sm:items-baseline sm:gap-1">
                      <p className="text-emerald-600 font-black text-sm sm:text-lg whitespace-nowrap">
                        {formatCurrencyBRL(product.price)}
                      </p>
                      <p className="text-[9px] text-slate-400 font-medium italic">
                        /{product.unitType === "weight" ? "kg" : "un"}
                      </p>
                    </div>

                    <div className="mt-auto pt-2">
                      {inCart ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-between bg-emerald-50 border-2 border-emerald-500 rounded-lg sm:rounded-xl p-0.5 sm:p-1"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(product, -1);
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-emerald-700 active:bg-emerald-200 rounded-md transition-colors"
                          >
                            <Minus size={14} strokeWidth={3} />
                          </button>

                          <span className="font-black text-emerald-900 text-[10px] sm:text-xs truncate">
                            {formatQty(inCart.qty, product.unitType)}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(product, 1);
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-emerald-700 active:bg-emerald-200 rounded-md transition-colors"
                          >
                            <Plus size={14} strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(product, 1);
                          }}
                          className="w-full bg-orange-500 text-white font-black py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs uppercase tracking-widest shadow-md active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                        >
                          <Plus size={14} strokeWidth={3} />
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="mt-8 px-6 text-center bg-green-900/95 rounded-t-[2rem] pb-40 flex flex-col items-center justify-center gap-4">
            {/* Banner de compartilhamento */}
            <div className="mt-6 px-4 sm:px-6">
              <button
                onClick={handleShareWhatsApp}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-[1.5rem] p-4 shadow-md flex items-center gap-3 active:scale-[0.98] transition-transform"
              >
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl flex-shrink-0">
                  <Share2 size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-black text-sm leading-tight">
                    Compartilhe no WhatsApp
                  </p>
                  <p className="text-[11px] font-bold text-emerald-50/90 leading-tight mt-0.5">
                    Convide vizinhos para colher também 🌱
                  </p>
                </div>
                <ChevronRight size={20} className="flex-shrink-0 opacity-80" />
              </button>
            </div>

            <div className="inline-flex items-center gap-2 text-white">
              <Leaf size={14} strokeWidth={3} />
              <span className="text-[11px] font-black uppercase tracking-widest">
                Direto do produtor para o seu apartamento
              </span>
            </div>
          </footer>

          {cartTotal > 0 && (
            <div className="fixed bottom-6 left-4 right-4 max-w-3xl mx-auto bg-emerald-900/95 backdrop-blur-xl text-white rounded-[2rem] shadow-2xl p-4 sm:p-5 flex justify-between items-center z-50">
              <div className="min-w-0">
                <p className="text-[9px] text-emerald-300 uppercase font-black tracking-widest mb-1">
                  Total
                </p>
                <p className="text-xl font-black truncate">
                  {formatCurrencyBRL(cartSubtotal)}
                </p>
              </div>

              <button
                onClick={() => setView("cart")}
                className="bg-emerald-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-black flex items-center gap-2 shadow-lg whitespace-nowrap text-sm"
              >
                Checkout <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== CART VIEW ===== */}
      {view === "cart" && (
        <div className="p-4 sm:p-6 bg-slate-50 min-h-screen pb-40">
          <button
            onClick={() => setView("catalog")}
            className="flex items-center gap-2 text-slate-400 mb-6 font-black text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> Voltar ao Pomar
          </button>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter mb-8">
            Meu Cesto
          </h2>

          <div className="max-w-2xl mx-auto space-y-6">
            <div className="space-y-3">
              {cartItems.map((item: any) => {
                const openDetail = () => {
                  const fresh =
                    products.find((p) => p.id === item.id) || item;
                  setSelectedProduct(fresh);
                  setProductOrigin("cart");
                  setView("product");
                };
                return (
                  <div
                    key={item.id}
                    onClick={openDetail}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetail();
                      }
                    }}
                    className="bg-white p-3 sm:p-4 rounded-[1.5rem] flex items-center gap-3 sm:gap-4 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <img
                      src={item.image}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover flex-shrink-0"
                      alt={item.name}
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-800 text-xs sm:text-sm truncate">
                        {item.name}
                      </h4>
                      <p className="text-slate-400 text-[10px] font-bold">
                        {formatCurrencyBRL(item.price)}/
                        {item.unitType === "weight" ? "kg" : "un"} ×{" "}
                        {formatQty(item.qty, item.unitType)}
                      </p>
                      <p className="text-emerald-700 text-xs font-black mt-0.5">
                        {formatCurrencyBRL(item.price * item.qty)}
                      </p>
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg flex-shrink-0"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(item, -1);
                        }}
                        className="p-1"
                      >
                        <Minus size={14} strokeWidth={3} />
                      </button>

                      <span className="font-black text-slate-800 text-[10px] w-12 text-center">
                        {formatQty(item.qty, item.unitType)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(item, 1);
                        }}
                        className="p-1"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulário de entrega */}
            <div
              id="customer-form"
              className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100"
            >
              <h3 className="font-black text-slate-900 mb-6 uppercase text-[10px] tracking-widest flex items-center gap-2">
                <MapPin size={14} className="text-emerald-600" /> Detalhes da
                Entrega
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <input
                    ref={nameInputRef}
                    name="name"
                    type="text"
                    required
                    placeholder="Seu nome *"
                    value={customerInfo.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    onBlur={() => handleInputBlur("name")}
                    aria-invalid={!!formErrors.name}
                    className={`w-full rounded-xl p-4 text-sm font-bold outline-none border-2 transition-colors ${
                      formErrors.name
                        ? "bg-red-50 border-red-500 text-red-900 placeholder:text-red-400 focus:ring-2 focus:ring-red-500/20"
                        : "bg-slate-50 border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-xs font-semibold mt-2 ml-1">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    ref={apartInputRef}
                    name="apart"
                    type="text"
                    required
                    placeholder="Apto *"
                    value={customerInfo.apart}
                    onChange={(e) => handleInputChange("apart", e.target.value)}
                    onBlur={() => handleInputBlur("apart")}
                    aria-invalid={!!formErrors.apart}
                    className={`w-full rounded-xl p-4 text-sm font-bold outline-none border-2 transition-colors ${
                      formErrors.apart
                        ? "bg-red-50 border-red-500 text-red-900 placeholder:text-red-400 focus:ring-2 focus:ring-red-500/20"
                        : "bg-slate-50 border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    }`}
                  />
                  {formErrors.apart && (
                    <p className="text-red-500 text-xs font-semibold mt-2 ml-1">
                      {formErrors.apart}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    name="condoName"
                    type="text"
                    disabled
                    placeholder="Condomínio"
                    value={condoName}
                    readOnly
                    className="w-full rounded-xl p-4 text-sm font-bold outline-none border bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    name="address"
                    type="text"
                    disabled
                    placeholder="Endereço"
                    value={customerInfo.address}
                    readOnly
                    className="w-full rounded-xl p-4 text-sm font-bold outline-none border bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                  Janela de Entrega
                </label>

                <div className="flex flex-col gap-2">
                  {deliverySlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-full text-left p-4 rounded-xl border-2 font-bold text-xs transition-colors ${
                        selectedSlot === slot
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-slate-50 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                  Forma de Pagamento
                </label>

                <div className="w-full p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 flex items-center gap-3">
                  <div className="bg-emerald-600 text-white p-2 rounded-lg flex-shrink-0">
                    <QrCode size={18} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-emerald-900 text-sm leading-tight">
                      Pix
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700/80 leading-tight mt-0.5">
                      Link de pagamento Nubank no WhatsApp
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-1 rounded-md flex-shrink-0">
                    Recomendado
                  </span>
                </div>

                <p className="text-[10px] font-bold text-slate-400 ml-2 mt-2">
                  Em breve outras formas de pagamento.
                </p>
              </div>
            </div>

            <div className="bg-emerald-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl">
              <div className="space-y-2 mb-4 pb-4 border-b border-emerald-700/60">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Subtotal
                  </span>
                  <span className="text-sm font-black text-white">
                    {formatCurrencyBRL(cartSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Frete fixo
                  </span>
                  <span className="text-sm font-black text-white">
                    {formatCurrencyBRL(settings.shippingFee)}
                  </span>
                </div>
                {settings.minOrder > 0 && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      Pedido mínimo
                    </span>
                    <span className="text-sm font-black text-white">
                      {formatCurrencyBRL(settings.minOrder)}
                    </span>
                  </div>
                )}
              </div>

              {!meetsMinOrder && settings.minOrder > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-amber-400/10 border border-amber-400/40 text-amber-200 text-xs font-bold">
                  Faltam {formatCurrencyBRL(settings.minOrder - cartSubtotal)}{" "}
                  para atingir o pedido mínimo de{" "}
                  {formatCurrencyBRL(settings.minOrder)}.
                </div>
              )}

              <div className="flex justify-between items-center mb-6 gap-2">
                <span className="text-base font-black tracking-tight whitespace-nowrap">
                  Total a pagar
                </span>
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 truncate">
                  {formatCurrencyBRL(cartTotal)}
                </span>
              </div>

              <button
                onClick={handleWhatsAppCheckout}
                disabled={!meetsMinOrder || cartItems.length === 0}
                className={`w-full text-white py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all ${
                  meetsMinOrder && cartItems.length > 0
                    ? "bg-emerald-500 hover:bg-emerald-400 active:scale-95"
                    : "bg-emerald-500/40 cursor-not-allowed"
                }`}
              >
                <MessageCircle size={22} />
                {!meetsMinOrder && cartItems.length > 0
                  ? "Abaixo do pedido mínimo"
                  : "Finalizar WhatsApp"}
              </button>
            </div>

            {/* Banner de compartilhamento */}
            <div className="mt-6 px-4 sm:px-6">
              <button
                onClick={handleShareWhatsApp}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-[1.5rem] p-4 shadow-md flex items-center gap-3 active:scale-[0.98] transition-transform"
              >
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl flex-shrink-0">
                  <Share2 size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-black text-sm leading-tight">
                    Compartilhe no WhatsApp
                  </p>
                  <p className="text-[11px] font-bold text-emerald-50/90 leading-tight mt-0.5">
                    Convide vizinhos para colher também 🌱
                  </p>
                </div>
                <ChevronRight size={20} className="flex-shrink-0 opacity-80" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRODUCT DETAIL VIEW ===== */}
      {view === "product" && selectedProduct && (() => {
        const product = selectedProduct;
        const inCart = cart[product.id];
        const unitLabel = product.unitType === "weight" ? "kg" : "un";
        return (
          <div className="bg-slate-50 min-h-screen pb-40">
            <div className="relative bg-slate-200 aspect-square sm:aspect-[16/10] overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  setView(productOrigin);
                  setSelectedProduct(null);
                }}
                aria-label="Voltar"
                className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
              >
                <ArrowLeft size={20} strokeWidth={3} className="text-slate-900" />
              </button>
              <button
                onClick={() => setView("cart")}
                aria-label="Ver cesto"
                className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform relative"
              >
                <ShoppingBasket size={20} strokeWidth={2.5} className="text-emerald-700" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

            <div className="px-5 sm:px-8 -mt-6 relative">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 sm:p-8">
                {product.category && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3">
                    <Leaf size={12} strokeWidth={3} />
                    {product.category}
                  </span>
                )}

                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-tight mb-3">
                  {product.name}
                </h1>

                <div className="flex items-baseline gap-1 mb-6">
                  <p className="text-emerald-600 font-black text-3xl">
                    {formatCurrencyBRL(product.price)}
                  </p>
                  <p className="text-sm text-slate-400 font-bold italic">
                    /{unitLabel}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Sobre o produto
                  </h2>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">
                    {getProductDescription(product)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Unidade
                    </p>
                    <p className="text-sm font-black text-slate-800">
                      {product.unitType === "weight" ? "Por quilo" : "Por unidade"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Incremento
                    </p>
                    <p className="text-sm font-black text-slate-800">
                      {formatQty(product.step, product.unitType)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="fixed bottom-6 left-4 right-4 max-w-3xl mx-auto z-50">
              {inCart ? (
                <div className="bg-white border-2 border-emerald-500 rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 bg-emerald-50 rounded-xl p-1 flex-1">
                    <button
                      onClick={() => updateQuantity(product, -1)}
                      className="w-11 h-11 flex items-center justify-center text-emerald-700 active:bg-emerald-200 rounded-lg transition-colors"
                    >
                      <Minus size={18} strokeWidth={3} />
                    </button>
                    <span className="font-black text-emerald-900 text-sm flex-1 text-center">
                      {formatQty(inCart.qty, product.unitType)}
                    </span>
                    <button
                      onClick={() => updateQuantity(product, 1)}
                      className="w-11 h-11 flex items-center justify-center text-emerald-700 active:bg-emerald-200 rounded-lg transition-colors"
                    >
                      <Plus size={18} strokeWidth={3} />
                    </button>
                  </div>
                  <button
                    onClick={() => setView("cart")}
                    className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform whitespace-nowrap"
                  >
                    Ver cesto
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => updateQuantity(product, 1)}
                  className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black text-base uppercase tracking-widest shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={20} strokeWidth={3} />
                  Adicionar ao cesto
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== SUCCESS VIEW ===== */}
      {view === "success" && (
        <SuccessView setView={setView} setCart={setCart} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background-color: #f8fafc;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (max-width: 350px) {
          .xs\\:grid-cols-2 {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
};

export default App;
