"use client"

import { XCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface NotificationModalProps {
  show: boolean
  title: string
  message: string
  isError: boolean
  onClose: () => void
}

export default function NotificationModal({ show, title, message, isError, onClose }: NotificationModalProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <CardContent className="p-8 text-center">
          {isError ? (
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          ) : (
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          )}

          <h3 className="text-2xl font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>

          <Button
            onClick={onClose}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
