# make_manual.py - 生成《张老师随身讲 使用说明书》PDF
import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONTS = [r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simsun.ttc', r'C:\Windows\Fonts\simhei.ttf']
fp = next((p for p in FONTS if os.path.exists(p)), None)
if not fp:
    print('找不到中文字体'); sys.exit(1)
try:
    pdfmetrics.registerFont(TTFont('CJK', fp, subfontIndex=0))
except Exception:
    pdfmetrics.registerFont(TTFont('CJK', fp))

h1 = ParagraphStyle('h1', fontName='CJK', fontSize=20, leading=28, spaceAfter=8)
h2 = ParagraphStyle('h2', fontName='CJK', fontSize=14, leading=22, spaceBefore=10, spaceAfter=4, textColor='#1a3b8f')
body = ParagraphStyle('body', fontName='CJK', fontSize=10.5, leading=17)

def P(t, s=body):
    return Paragraph(t, s)

# 转义 XML
def x(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

out = os.environ.get('MANUAL_OUT') or '使用说明书.pdf'
doc = SimpleDocTemplate(out, pagesize=A4, title='张老师随身讲 使用说明书', leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=1.8*cm)
story = [
    P('张老师随身讲 使用说明书', h1),
    P('版本：V1.0.1000 及以上（此文档随版本一起发布）', ParagraphStyle('v', fontName='CJK', fontSize=9, textColor='#666', leading=14)),
    P('<b>一句话介绍：</b>一张题目图片（或 PDF/Word/Markdown），<b>张老师</b>自动生成带注释的代码、讲透解题思路，再用<font color="#1a3b8f">数字人老师</font>用自然语音逐句讲给你听，并自动记住你的薄弱点，越用越懂你。', body),
    Spacer(1, 8), P('一、安装 / 免安装运行', h2),
    ListFlowable([
        ListItem(P('安装版：双击 <b>张老师随身讲-V1.0.xxxx.exe</b> 安装，桌面/开始菜单生成「张老师随身讲」快捷方式。')),
        ListItem(P('免安装版：解压 <b>张老师随身讲-免安装.zip</b>，进入 win-unpacked 文件夹，双击 <b>张老师随身讲.exe</b> 即可运行，不需要安装。')),
    ], bulletType='bullet', fontName='CJK', leftIndent=14),
    P('系统要求：Windows 10/11 x64；运行讲解语音需要<font color="#c0392b">联网</font>（调用在线语音与 AI 模型）。', body),
    Spacer(1, 8), P('二、界面与左侧/右侧说明', h2),
    ListFlowable([
        ListItem(P('<b>左侧</b>：带逐行中文注释的参考 C++ 代码。讲到哪里，哪一行会高亮。')),
        ListItem(P('<b>右侧上半</b>：详细解题思路（题意、算法、复杂度、样例推演、易错点）。')),
        ListItem(P('<b>右侧下半</b>：数字人老师。讲稿逐句高亮当前讲到的一句；头像固定不动。')),
    ], bulletType='bullet', fontName='CJK', leftIndent=14),
    Spacer(1, 8), P('三、使用步骤', h2),
    ListFlowable([
        ListItem(P('<b>1 上传题目</b>：点「选择题目文件」选一张题目截图 / PDF / Word / Markdown。')),
        ListItem(P('<b>也可用截图</b>：点「题目截图」，软件会最小化；按住左键框选题目区域，松开后点<b>绿色 ✓</b> 确认（或<b>红色 ✕</b> 取消），确认后自动回传并分析。')),
        ListItem(P('<b>2 开始讲解</b>：点「开始讲解」。按钮变为「讲解中」（不可重复点）；生成后自动开口讲解，按钮随后显示「讲解完毕」。')),
        ListItem(P('<b>3 听讲</b>：用「上一句 / 播放 / 暂停 / 下一句 / 语速」控制讲解）。讲完后点「上一句」会回到「讲解中」。')),
        ListItem(P('<b>4 下载</b>：点「下载代码」保存为 <b>题目名.cpp</b>；点「下载讲解」保存为 <b>题目名.doc</b>（含思路、讲稿、代码）。')),
    ], bulletType='1', fontName='CJK', leftIndent=14),
    Spacer(1, 8), P('四、个性化记忆', h2),
    P('讲解后，下方出现「标记知识点」。把你没弄懂的点一下（变橙色），软件会记进你的学习档案；<b>下次讲解时会针对薄弱点多讲、重点复习</b>。', body),
    Spacer(1, 8), P('五、常见问题', h2),
    ListFlowable([
        ListItem(P('<b>没有语音/讲解失败</b>：请确认电脑已联网；网络不稳定时重试一次。')),
        ListItem(P('<b>截图确认后没反应</b>：请确保框选区域别太小，松开后再点 ✓。')),
        ListItem(P('<b>单文件便携版打不开</b>：请改用「免安装 zip」解压运行。')),
    ], bulletType='bullet', fontName='CJK', leftIndent=14),
    Spacer(1, 10),
    P('—— 祝学习愉快，张老师与你同行 ——', ParagraphStyle('ft', fontName='CJK', fontSize=9, textColor='#888', alignment=1, leading=14)),
]
doc.build(story)
print('已生成:', os.path.abspath(out))
