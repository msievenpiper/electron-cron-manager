import { Job } from '../../../shared/types'

interface Props {
  job: Job | null
  onClose: () => void
  onSave: () => void
}

export default function JobEditorDrawer({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-10" onClick={onClose}>
      <div className="w-96 bg-gray-900 h-full p-6">
        <p className="text-gray-400">Editor coming soon...</p>
      </div>
    </div>
  )
}
