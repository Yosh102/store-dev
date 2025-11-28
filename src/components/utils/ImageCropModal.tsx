import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Cropper, { ReactCropperElement } from 'react-cropper'
import 'cropperjs/dist/cropper.css'

interface ImageCropModalProps {
  file: File
  onCrop: (croppedImage: Blob) => void
  onClose: () => void
}

export default function ImageCropModal({ file, onCrop, onClose }: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string>('')
  const cropperRef = useRef<ReactCropperElement>(null)

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = (e) => setImageSrc(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [file])

  const handleCrop = () => {
    const imageElement = cropperRef?.current
    const cropper = imageElement?.cropper

    if (cropper) {
      cropper.getCroppedCanvas().toBlob((blob) => {
        if (blob) {
          onCrop(blob)
        }
      }, 'image/jpeg')
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>画像をクロップ</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {imageSrc ? (
            <Cropper
              ref={cropperRef}
              src={imageSrc}
              style={{ height: 400, width: '100%' }}
              aspectRatio={1}
              guides={false}
            />
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p>Loading...</p>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleCrop} disabled={!imageSrc}>クロップして保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

