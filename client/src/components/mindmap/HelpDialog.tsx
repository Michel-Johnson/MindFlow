import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, MousePointerClick, Type, Save, Keyboard, Move, Download } from "lucide-react";

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            欢迎使用 MindFlow
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-normal">Beta</span>
          </DialogTitle>
          <DialogDescription>
            专业的 Markdown 思维导图工具，灵感来自 Typora 和 XMind
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              <Type className="w-4 h-4" />
              Markdown 编辑
            </h3>
            <p className="text-sm text-muted-foreground">
              双击节点进入<strong>编辑模式</strong>，支持完整的 Markdown 语法：
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
              <li>**粗体** 和 *斜体*</li>
              <li># 标题</li>
              <li>`代码块`</li>
              <li>- 项目列表</li>
              <li>$E=mc^2$ (数学公式)</li>
              <li>![图片](url) 图片</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              <Keyboard className="w-4 h-4" />
              快捷键
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>添加子节点</span>
                <kbd className="bg-background border px-1.5 rounded text-xs">Tab</kbd>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>添加同级节点</span>
                <kbd className="bg-background border px-1.5 rounded text-xs">Enter</kbd>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>删除节点</span>
                <kbd className="bg-background border px-1.5 rounded text-xs">Backspace</kbd>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>编辑节点</span>
                <kbd className="bg-background border px-1.5 rounded text-xs">双击</kbd>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>退出编辑</span>
                <kbd className="bg-background border px-1.5 rounded text-xs">Esc</kbd>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              <MousePointerClick className="w-4 h-4" />
              鼠标操作
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>平移画布</span>
                <span className="text-xs">右键拖动</span>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>缩放</span>
                <span className="text-xs">滚轮</span>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>框选节点</span>
                <span className="text-xs">左键拖动</span>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>调整节点大小</span>
                <span className="text-xs">拖动右下角</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              <Move className="w-4 h-4" />
              节点操作
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>移动节点</span>
                <span className="text-xs">直接拖动</span>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>调整大小</span>
                <span className="text-xs">拖动右下角</span>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>编辑内容</span>
                <span className="text-xs">双击节点</span>
              </li>
              <li className="flex justify-between items-center bg-muted/50 p-2 rounded">
                <span>编辑时换行</span>
                <span className="text-xs">Enter</span>
              </li>
            </ul>
          </div>

          <div className="col-span-2 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              <Download className="w-4 h-4" />
              导出功能
            </h3>
            <p className="text-sm text-muted-foreground">
              您的工作会自动保存到浏览器本地存储。使用<strong>侧边栏</strong>可以将思维导图导出为 PNG、SVG、PDF 或项目文件 (.json)。
              导出时会自动计算所有节点的边界，确保内容居中显示。
            </p>
          </div>

          <div className="col-span-2 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              <Save className="w-4 h-4" />
              Windows 本地化部署
            </h3>
            <p className="text-sm text-muted-foreground">
              本应用支持 Windows 本地化部署。导出的 JSON 文件可以随时重新加载，确保数据持久化。
              所有数据存储在浏览器本地，无需网络连接即可使用。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
