#!/usr/bin/env python3
import subprocess
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TUTORIAL_DIR = os.path.join(BASE_DIR, '../public/tutorial')

# Create audio files for MP4 sections
audio_files = {
    '00_intro.mp3': 'مرحباً بك في نظام إدارة العيادة الشامل، نظام Cliniva. هذا النظام مصمم ليساعدك في إدارة عيادتك بكفاءة عالية، من إدارة المرضى والأطباء، إلى المواعيد والعمليات والأرباح. دعنا نبدأ الجولة الشاملة.',
    
    '16_whatsapp_demo.mp3': 'هنا نرى قسم الرسائل والتواصل عبر WhatsApp. يمكنك استقبال حجوزات العملاء مباشرة عبر WhatsApp، والرد على استفسارات المرضى. النظام يدعم الرد التلقائي والحفاظ على سجل كامل لجميع المحادثات.',
    
    '17_excel_demo.mp3': 'يمكنك تصدير كل بيانات العيادة إلى ملفات Excel. يمكنك تصدير جدول المواعيد الكامل، أو بيانات المرضى والعمليات والدفعات. هذا يسهل عليك مراجعة البيانات وتحليل الأداء خارج النظام.',
}

print('╔════════════════════════════════════════╗')
print('║  Generating Audio for MP4 Sections     ║')
print('╚════════════════════════════════════════╝\n')

for filename, text in audio_files.items():
    filepath = os.path.join(TUTORIAL_DIR, filename)
    
    if os.path.exists(filepath):
        print(f'⊘ {filename} already exists, skipping')
        continue
    
    print(f'Generating {filename}...')
    
    # Write text to temp file (workaround for encoding issues)
    temp_txt = f'/tmp/{filename}.txt'
    with open(temp_txt, 'w', encoding='utf-8') as f:
        f.write(text)
    
    try:
        # Use edge-tts to generate audio
        cmd = [
            'python', '-m', 'edge_tts',
            '--voice', 'ar-EG-ShakirNeural',
            '--file', temp_txt,
            '--write-media', filepath
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print(f'✓ {filename}')
        else:
            print(f'✗ {filename}: {result.stderr}')
        
        # Clean up temp file
        if os.path.exists(temp_txt):
            os.remove(temp_txt)
    except Exception as e:
        print(f'✗ {filename}: {e}')

print('\n╔════════════════════════════════════════╗')
print('║  Audio generation complete             ║')
print('╚════════════════════════════════════════╝')
