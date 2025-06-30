"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, ShoppingCart, ArrowLeft, Scan } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BarcodeScanner from "./components/barcode-scanner"
import ProductResult from "./components/product-result"
import NotificationModal from "./components/notification-modal"

interface Product {
  internalCode: string
  barcode: string
  name: string
  price: number
}

type Screen = "home" | "scanner" | "search" | "search-results" | "result"

// Coloque esta função fora do componente, logo após os imports
const normalizeString = (str: string): string => {
  if (!str) return ""
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export default function PriceConsultationApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    title: string
    message: string
    isError: boolean
  }>({
    show: false,
    title: "",
    message: "",
    isError: true,
  })
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [companyData, setCompanyData] = useState<string>("")

  // Carregar produtos da API
  useEffect(() => {
    loadProducts()
    loadCompanyData()

    // Atualizar dados a cada 30 segundos (30000ms) em background
    const interval = setInterval(() => {
      loadProducts(true) // true = silent update
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const loadCompanyData = async () => {
    try {
      const response = await fetch("https://dadosloja2.s3.us-east-2.amazonaws.com/precos2.json", {
        cache: "no-cache",
      })
      const data = await response.json()

      if (Array.isArray(data)) {
        const company = data.find((item) => item.Fantasia && item.Fantasia !== "--------")
        if (company) {
          setCompanyData(company.Fantasia)
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados da empresa:", error)
    }
  }

  const loadProducts = async (silent = false) => {
    const url = "https://dadosloja2.s3.us-east-2.amazonaws.com/precos2.json"

    try {
      if (!silent) setLoading(true)

      console.log(`🔄 Carregando dados... (Silent: ${silent})`, new Date().toLocaleTimeString())

      // Adicionar cache-busting para forçar nova requisição
      const cacheBuster = `?t=${Date.now()}`
      const response = await fetch(url + cacheBuster, {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`📦 Dados recebidos:`, data.length, "itens")

      if (Array.isArray(data)) {
        const mappedProducts = data
          .map((item) => ({
            internalCode: item["Codigo da Mercadoria"],
            barcode: item["Cod Fabricante"],
            name: item["Mercadoria"],
            price: Number.parseFloat(item["Preco de Venda"]),
          }))
          .filter((p) => p.name && !isNaN(p.price) && !p.name.includes("---"))

        setProducts(mappedProducts)
        console.log(`✅ ${mappedProducts.length} produtos processados e carregados!`)

        if (!silent) {
          console.log("🔍 Primeiros 5 produtos:", mappedProducts.slice(0, 5))
        }
      } else {
        throw new Error("O formato do JSON não é um array.")
      }
    } catch (error) {
      console.error("❌ Falha ao carregar dados dos produtos:", error)
      if (!silent) {
        showNotification(
          "Erro de Conexão",
          "Não foi possível carregar os dados. Verifique a conexão com a internet.",
          true,
        )
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

// SUBSTITUA a função intelligentSearch inteira por esta:
  const intelligentSearch = (query: string): { type: "single" | "multiple"; results: Product[] } => {
    const searchTerm = query.trim()
    console.log(`🔍 Buscando por: "${searchTerm}" em ${products.length} produtos`)

    // 1. Busca por código de barras (prioridade máxima)
    const isBarcode = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(searchTerm)
    if (isBarcode) {
      console.log(`📋 Tipo de busca: Código de Barras`)
      const product = products.find((p) => p.barcode && p.barcode === searchTerm)
      console.log(`🔍 Busca por código de barras: ${product ? "ENCONTRADO" : "NÃO ENCONTRADO"}`)
      return { type: "single", results: product ? [product] : [] }
    }

    // 2. Busca por código interno numérico
    const isNumericCode = /^\d+$/.test(searchTerm)
    if (isNumericCode) {
      console.log(`📋 Tipo de busca: Código Interno`)
      const product = products.find((p) => p.internalCode && p.internalCode === searchTerm)
      console.log(`🔍 Busca por código interno: ${product ? "ENCONTRADO" : "NÃO ENCONTRADO"}`)
      return { type: "single", results: product ? [product] : [] }
    }

    // 3. Busca por nome (multi-termo) como padrão para todo o resto
    console.log(`📋 Tipo de busca: Nome (multi-termo)`)
    const normalizedSearchTerm = normalizeString(searchTerm)

    const searchTerms = normalizedSearchTerm
      .split(" ")
      .filter((term) => term.length > 0)

    // Se não houver termos de busca válidos (ex: query era só ' '), retorna vazio
    if (searchTerms.length === 0) {
      console.log(`❌ Nenhum termo de busca aplicável`)
      return { type: "single", results: [] }
    }

    const matchingProducts = products
      .filter((p) => {
        const productNameNormalized = normalizeString(p.name)
        return searchTerms.every((term) => productNameNormalized.includes(term))
      })
      .slice(0, 50) // Limitar a 20 resultados

    console.log(`🔍 Busca por nome: ${matchingProducts.length} produtos encontrados`)
    return { type: "multiple", results: matchingProducts }
  }

  const handleProductFound = (product: Product | null) => {
    if (product) {
      setSelectedProduct(product)
      setCurrentScreen("result")
    } else {
      showNotification("Produto não encontrado", "O código ou nome informado não foi localizado.", true)
    }
  }

  const handleBarcodeScanned = (barcode: string) => {
    const product = intelligentSearch(barcode).results[0] || null
    handleProductFound(product)
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const searchResult = intelligentSearch(searchQuery)

      if (searchResult.results.length === 0) {
        showNotification(
          "Nenhum produto encontrado",
          "Tente uma busca diferente ou verifique se o código está correto.",
          true,
        )
      } else if (searchResult.type === "single") {
        setSelectedProduct(searchResult.results[0])
        setCurrentScreen("result")
      } else {
        setSearchResults(searchResult.results)
        setCurrentScreen("search-results")
      }
      setSearchQuery("")
    }
  }

  const showNotification = (title: string, message: string, isError: boolean) => {
    setNotification({
      show: true,
      title,
      message,
      isError,
    })
  }

  const closeNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const goHome = () => {
    setCurrentScreen("home")
    setSelectedProduct(null)
  }

  // Tela Principal
  if (currentScreen === "home") {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex flex-col">
        <div className="flex-1 flex flex-col justify-center p-4 py-4 pb-20">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <div className="bg-yellow-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-7 h-7 text-purple-800" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Consulta Preço</h1>

              {/* Campo de pesquisa no cabeçalho */}
              <form onSubmit={handleManualSearch} className="mb-6">
                <div className="relative">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Digite o código ou nome do produto"
                    className="text-base p-4 bg-white rounded-xl border-0 focus:ring-2 focus:ring-yellow-400 transition-all w-full pr-12 pl-4"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-yellow-400 hover:bg-yellow-500 text-purple-800 rounded-lg"
                  >
                    <Search className="w-5 h-5" />
                  </Button>
                </div>
              </form>

              {/* Botão do scanner logo abaixo do campo de pesquisa */}
              <Button
                onClick={() => setCurrentScreen("scanner")}
                disabled={loading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-purple-800 font-bold text-base rounded-xl shadow-lg transition-all duration-200 active:scale-95 mb-4"
              >
                <Scan className="w-5 h-5 mr-2" />
                Escanear Código de Barras
              </Button>
            </div>

            {loading && (
              <div className="text-center mt-4">
                <div className="inline-flex items-center text-white/80 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Carregando produtos...
                </div>
              </div>
            )}
          </div>

          <NotificationModal
            show={notification.show}
            title={notification.title}
            message={notification.message}
            isError={notification.isError}
            onClose={closeNotification}
          />
        </div>

        {/* Footer fixo */}
        <footer className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm border-t border-white/20 p-2">
          <div className="text-center">
            <p className="text-white/80 text-xs font-medium">© 2025 millersantosbr</p>
            <p className="text-white/60 text-xs mt-1">{companyData || "Carregando empresa..."}</p>
          </div>
        </footer>
      </div>
    )
  }

  // Tela do Scanner
  if (currentScreen === "scanner") {
    return (
      <div className="min-h-screen bg-black">
        <BarcodeScanner onBarcodeScanned={handleBarcodeScanned} onBack={goHome} />
        <NotificationModal
          show={notification.show}
          title={notification.title}
          message={notification.message}
          isError={notification.isError}
          onClose={closeNotification}
        />
      </div>
    )
  }

  // Tela de Pesquisa Manual - redirecionar para home
  if (currentScreen === "search") {
    setCurrentScreen("home")
    return null
  }

  // Tela de Resultado
  if (currentScreen === "result" && selectedProduct) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-600 to-purple-800">
        <ProductResult product={selectedProduct} onNewQuery={goHome} />
      </div>
    )
  }

  // Tela de Resultados Múltiplos
  if (currentScreen === "search-results") {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-600 to-purple-800 p-4">
        <div className="max-w-md mx-auto h-full flex flex-col">
          {/* Header fixo */}
          <div className="flex items-center mb-3">
            <Button
              onClick={() => setCurrentScreen("search")}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold text-white ml-4">Resultados ({searchResults.length})</h1>
          </div>

          {/* Lista com scroll */}
          <div
            className="flex-1 overflow-y-auto"
            style={{
              height: "calc(100vh - 140px)",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            {searchResults.map((product) => (
              <div
                key={`${product.internalCode}-${product.barcode}`}
                onClick={() => {
                  setSelectedProduct(product)
                  setCurrentScreen("result")
                }}
                className="bg-white rounded-xl p-3 shadow-lg active:scale-95 transition-all duration-150 cursor-pointer mb-2"
              >
                <h3 className="font-bold text-gray-900 text-sm mb-1 leading-tight line-clamp-2">{product.name}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-purple-600">
                    R$ {product.price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">Cód: {product.internalCode}</span>
                </div>
              </div>
            ))}

            {/* Espaçamento no final */}
            <div className="h-16"></div>
          </div>

          {/* Info de resultados */}
          {searchResults.length === 20 && (
            <p className="text-center text-purple-200 text-xs mt-2">Primeiros 20 resultados. Refine sua busca.</p>
          )}
        </div>

        {/* Footer fixo */}
        <footer className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm border-t border-white/20 p-2">
          <div className="text-center">
            <p className="text-white/80 text-xs font-medium">© 2025 millersantosbr</p>
            <p className="text-white/60 text-xs mt-1">{companyData || "Carregando empresa..."}</p>
          </div>
        </footer>
      </div>
    )
  }

  return null
}
