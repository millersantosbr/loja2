"use client"

import { useEffect, useRef, useState } from "react"
import { X, Camera, RotateCcw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

// Lazy-loader para QuaggaJS
let Quagga: any = null
async function loadQuagga() {
  if (Quagga) return Quagga
  Quagga = await import("quagga")
  return Quagga
}

interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void
  onBack: () => void
}

export default function BarcodeScanner({ onBarcodeScanned, onBack }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState<string>("")
  const [scanCount, setScanCount] = useState(0)
  const [isFlashOn, setIsFlashOn] = useState(false) // Novo estado para o flash
  const videoTrackRef = useRef<MediaStreamTrack | null>(null) // Referência para a trilha de vídeo

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.type = "square"

      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.warn("Não foi possível reproduzir som:", error)
    }
  }

  const getCameraName = (camera: MediaDeviceInfo, index: number) => {
    const label = camera.label.toLowerCase()
    if (label.includes("back") || label.includes("rear") || label.includes("environment")) {
      return "Traseira"
    }
    if (label.includes("front") || label.includes("user") || label.includes("selfie")) {
      return "Frontal"
    }
    return `Câmera ${index + 1}`
  }

  const initializeCameras = async () => {
    try {
      // Solicitar permissão inicial para listar as câmeras
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach((track) => track.stop()) // Parar a stream temporária imediatamente

      // Listar câmeras
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")

      if (videoDevices.length === 0) {
        throw new Error("Nenhuma câmera encontrada")
      }

      setCameras(videoDevices)

      // Priorizar câmera traseira
      const backCameraIndex = videoDevices.findIndex(
        (device) =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("rear") ||
          device.label.toLowerCase().includes("environment"),
      )

      setCurrentCameraIndex(backCameraIndex >= 0 ? backCameraIndex : 0)
      console.log("📷 Câmeras encontradas:", videoDevices.length)
    } catch (err) {
      console.error("❌ Erro ao inicializar câmeras:", err)
      throw err
    }
  }

  const startScanner = async (cameraIndexParam?: number) => {
    try {
      setIsLoading(true)
      setError("")
      setScanCount(0)
      setLastScannedCode("") // Resetar último código escaneado
      setIsFlashOn(false) // Desligar o flash ao reiniciar o scanner

      // Parar scanner anterior e liberar a track
      await stopScanner()
      if (videoTrackRef.current) {
        videoTrackRef.current.stop()
        videoTrackRef.current = null
      }
      await new Promise((resolve) => setTimeout(resolve, 300)) // Pequeno delay

      const QuaggaLib = await loadQuagga()

      if (!scannerRef.current) {
        throw new Error("Container do scanner não encontrado")
      }

      // Limpar container
      scannerRef.current.innerHTML = ""

      const selectedCamera = cameras[cameraIndexParam !== undefined ? cameraIndexParam : currentCameraIndex]

      if (!selectedCamera) {
        throw new Error("Câmera selecionada não encontrada.")
      }

      // Obter o stream de vídeo diretamente para ter controle sobre a track
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedCamera.deviceId },
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
          facingMode: selectedCamera.label.toLowerCase().includes("front") ? "user" : "environment", // Sugere facingMode
        },
      })
      videoTrackRef.current = stream.getVideoTracks()[0] // Salva a referência da trilha de vídeo

      // Configuração do QuaggaJS
      const config = {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            // Não passamos deviceId aqui, pois o stream já foi criado
            // Quagga usará o stream que ele "pegar" do target
          },
          // Passa o MediaStream diretamente para o Quagga
          // Isso é uma extensão que nem sempre é documentada, mas funciona se o target for um elemento de vídeo
          // Ou podemos simplesmente deixar o Quagga usar a stream que ele iniciaria no target
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"],
          debug: {
            showCanvas: false,
            showPatches: false,
            showFoundPatches: false,
            showSkeleton: false,
            showLabels: false,
            showPatchLabels: false,
            showRemainingPatchLabels: false,
            boxFromPatches: {
              showTransformed: false,
              showTransformedBox: false,
              showBB: false,
            },
          },
          multiple: false,
        },
        locate: true,
      }

      console.log("🚀 Iniciando QuaggaJS com stream externo...")

      // Inicializar QuaggaJS, passando o MediaStream gerado
      await new Promise<void>((resolve, reject) => {
        // Quagga init com o stream direto, se suportado ou config.inputStream.target será suficiente
        QuaggaLib.init(
          {
            ...config,
            inputStream: {
              ...config.inputStream,
              stream: stream, // Passa o stream diretamente
            },
          },
          (err: any) => {
            if (err) {
              console.error("❌ Erro ao inicializar QuaggaJS:", err)
              // Certifique-se de parar a stream em caso de erro na inicialização do Quagga
              if (videoTrackRef.current) {
                videoTrackRef.current.stop()
                videoTrackRef.current = null
              }
              reject(err)
              return
            }
            console.log("✅ QuaggaJS inicializado!")
            resolve()
          },
        )
      })

      // Callback de detecção
      QuaggaLib.onDetected((result: any) => {
        const code = result.codeResult.code
        console.log("🎯 Código detectado:", code)

        if (/^\d{8,14}$/.test(code) && code !== lastScannedCode) {
          setLastScannedCode(code)
          console.log("✅ Código válido:", code)

          // Feedback
          playBeepSound()
          if (navigator.vibrate) {
            navigator.vibrate(100)
          }

          // Parar e retornar
          stopScanner()
          onBarcodeScanned(code)
        }
      })

      // Callback de processamento
      QuaggaLib.onProcessed(() => {
        setScanCount((prev) => prev + 1)
      })

      // Iniciar scanner
      QuaggaLib.start()
      setIsScanning(true)
      setIsLoading(false)

      console.log("🎥 Scanner iniciado!")
    } catch (err: any) {
      console.error("❌ Erro ao iniciar scanner:", err)
      setIsLoading(false)
      setIsFlashOn(false) // Garante que o flash esteja desligado em caso de erro

      if (err.name === "NotAllowedError") {
        setError("Permissão da câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.")
      } else if (err.name === "NotFoundError" || err.message.includes("no camera")) {
        setError("Nenhuma câmera encontrada ou acessível.")
      } else {
        setError("Erro ao inicializar câmera. Tente novamente.")
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.stop()
        videoTrackRef.current = null
      }
    }
  }

  const stopScanner = async () => {
    try {
      const QuaggaLib = await loadQuagga()
      if (QuaggaLib && typeof QuaggaLib.stop === "function") {
        QuaggaLib.stop()
        console.log("🛑 Scanner parado")
      }
    } catch (err) {
      console.warn("⚠️ Erro ao parar scanner:", err)
    }

    if (videoTrackRef.current) {
      videoTrackRef.current.stop()
      videoTrackRef.current = null
    }
    setIsScanning(false)
    setIsFlashOn(false) // Desligar flash ao parar
    if (navigator.vibrate) {
      navigator.vibrate(0)
    }
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return
    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    await startScanner(nextIndex)
  }

  const toggleFlash = async () => {
    if (!videoTrackRef.current) {
      console.warn("❌ Não há track de vídeo ativa para controlar o flash.")
      return
    }

    const capabilities = videoTrackRef.current.getCapabilities()
    // Verifica se a câmera suporta a funcionalidade de tocha/flash
    if (!capabilities.torch) {
      console.warn("⚠️ A câmera atual não suporta flash/tocha.")
      // Você pode mostrar uma notificação ao usuário aqui
      return
    }

    try {
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: !isFlashOn }], // Inverte o estado do flash
      })
      setIsFlashOn(!isFlashOn)
      console.log(`💡 Flash: ${!isFlashOn ? "LIGADO" : "DESLIGADO"}`)
    } catch (err) {
      console.error("❌ Erro ao alternar flash:", err)
      // Tratar erro, talvez mostrar notificação
    }
  }

  // Efeito para inicializar câmeras e scanner
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeCameras()
        // `startScanner` será chamado após as câmeras serem carregadas
      } catch (err) {
        console.error("❌ Erro na inicialização das câmeras:", err)
        setError("Erro ao carregar câmeras: " + (err as Error).message)
        setIsLoading(false)
      }
    }

    initialize()

    return () => {
      stopScanner()
    }
  }, [])

  // Efeito para iniciar o scanner quando as câmeras são carregadas ou a câmera é trocada
  useEffect(() => {
    if (cameras.length > 0 && !isScanning && !isLoading && !error) {
      // Se não estiver escaneando e não estiver carregando, inicie o scanner com a câmera atual
      startScanner(currentCameraIndex)
    }
  }, [cameras, currentCameraIndex, isScanning, isLoading, error]) // Dependências

  // Tela de erro
  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-white max-w-sm">
            <Camera className="w-20 h-20 mx-auto mb-6 text-red-500" />
            <h2 className="text-2xl font-bold mb-4">Erro na Câmera</h2>
            <p className="mb-8 text-gray-300 text-lg leading-relaxed">{error}</p>
            <div className="space-y-4">
              <Button
                onClick={() => {
                  setError("")
                  window.location.reload() // Recarregar a página para tentar novamente
                }}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 text-lg rounded-xl"
              >
                Tentar Novamente
              </Button>
              <Button
                onClick={onBack}
                variant="outline"
                className="w-full border-white/30 text-white hover:bg-white/10 bg-transparent font-bold py-4 text-lg rounded-xl"
              >
                Voltar
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header fixo */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Button
              onClick={onBack}
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 rounded-full mr-3"
            >
              <X className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-white font-bold text-lg">Scanner de Código</h1>
              <p className="text-white/70 text-sm">
                {cameras[currentCameraIndex]
                  ? getCameraName(cameras[currentCameraIndex], currentCameraIndex)
                  : "Carregando..."}
              </p>
            </div>
          </div>

          {/* Status e Botão de Flash */}
          <div className="flex items-center space-x-3">
            {videoTrackRef.current && videoTrackRef.current.getCapabilities().torch && (
              <Button
                onClick={toggleFlash}
                size="icon"
                variant="ghost"
                className={`
                  rounded-full transition-colors duration-200
                  ${isFlashOn ? "bg-yellow-400 text-black hover:bg-yellow-500" : "text-white hover:bg-white/10"}
                `}
                disabled={isLoading}
              >
                <Zap className="w-6 h-6" />
              </Button>
            )}
            <div className="text-right">
              <div className="text-white text-sm font-medium">
                {isLoading ? "Iniciando..." : isScanning ? "Escaneando" : "Pausado"}
              </div>
              {isScanning && <div className="text-yellow-400 text-xs">{scanCount} tentativas</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Área da câmera */}
      <div className="flex-1 relative overflow-hidden">
        {/* Container do QuaggaJS */}
        <div
          ref={scannerRef}
          className="absolute inset-0 w-full h-full"
          style={{
            background: "#000",
          }}
        />

        {/* Overlay de guia */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Área escura ao redor */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Área de scan */}
          <div className="relative z-10">
            {/* Retângulo de guia */}
            <div className="w-72 h-40 border-2 border-yellow-400 rounded-2xl relative bg-transparent">
              {/* Cantos decorativos */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br-xl" />

              {/* Linha de scan animada */}
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-yellow-400 animate-pulse transform -translate-y-1/2" />

              {/* Indicador de atividade */}
              {isScanning && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold">
                    <Zap className="w-3 h-3 mr-1" />
                    ATIVO
                  </div>
                </div>
              )}
            </div>

            {/* Instruções */}
            <div className="mt-6 text-center">
              <p className="text-white text-sm font-medium mb-1">Posicione o código dentro da área amarela</p>
              <p className="text-white/60 text-xs">Mantenha distância de 10-20cm • Boa iluminação</p>
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4" />
              <p className="text-lg font-medium">Iniciando câmera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer fixo com controles */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm border-t border-white/10">
        <div className="p-4">
          {/* Botões principais */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            {cameras.length > 1 && (
              <Button
                onClick={switchCamera}
                disabled={isLoading}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl flex items-center"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Trocar Câmera
              </Button>
            )}
          </div>

          {/* Lista de câmeras disponíveis com os novos estilos */}
          {cameras.length > 1 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {cameras.map((camera, index) => (
                <button
                  key={camera.deviceId}
                  onClick={() => {
                    if (isLoading || index === currentCameraIndex) return
                    setCurrentCameraIndex(index)
                    startScanner(index)
                  }}
                  disabled={isLoading}
                  className={`
                    px-3 py-1 flex items-center justify-center rounded-full
                    text-xs font-medium transition-all whitespace-nowrap
                    ${
                      index === currentCameraIndex
                        ? "bg-yellow-400 text-black"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }
                  `}
                >
                  📷 {getCameraName(camera, index)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

