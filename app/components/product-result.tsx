"use client"

import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface Product {
  internalCode: string
  barcode: string
  name: string
  price: number
}

interface ProductResultProps {
  product: Product
  onNewQuery: () => void
}

export default function ProductResult({ product, onNewQuery }: ProductResultProps) {
  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace(".", ",")}`
  }

  const getCurrentTimestamp = () => {
    return new Date().toLocaleString("pt-BR")
  }

  return (
    <div className="h-screen flex flex-col p-4">
      <div className="max-w-md mx-auto flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center mb-4 mt-8 flex-shrink-0">
          <CheckCircle2 className="w-6 h-6 text-yellow-400 mr-3" />
          <h1 className="text-xl font-bold text-white">Produto Encontrado</h1>
        </div>

        {/* Card do produto - flex-1 para ocupar espaço disponível */}
        <Card className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <CardContent className="p-0 flex-1 flex flex-col min-h-0">
            {/* Nome do produto */}
            <div className="p-4 pb-2 flex-shrink-0">
              <p className="text-xs font-medium text-gray-500 mb-1">PRODUTO</p>
              <h2 className="text-base font-bold text-gray-900 leading-tight line-clamp-3">{product.name}</h2>
            </div>

            {/* Preço em destaque - flex-1 para ocupar espaço central */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-4 py-6 text-center flex-1 flex flex-col justify-center min-h-0">
              <p className="text-sm font-medium text-purple-100 mb-2">PREÇO</p>
              <p className="text-4xl font-extrabold tracking-tighter">{formatPrice(product.price)}</p>
            </div>

            {/* Códigos */}
            <div className="p-4 pt-3 flex-shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">CÓD. BARRAS</p>
                  <p className="text-sm font-mono text-gray-800 break-all leading-tight">{product.barcode}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">CÓD. INTERNO</p>
                  <p className="text-sm font-mono text-gray-800 leading-tight">{product.internalCode}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timestamp */}
        <p className="text-center text-xs text-purple-200 mt-2 flex-shrink-0">Consulta: {getCurrentTimestamp()}</p>

        {/* Botão Nova Consulta */}
        <Button
          onClick={onNewQuery}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-purple-800 font-bold py-4 text-base rounded-xl shadow-lg transition-all duration-200 active:scale-95 flex-shrink-0 mb-14 mt-4"
        >
          Nova Consulta
        </Button>
      </div>
    </div>
  )
}
