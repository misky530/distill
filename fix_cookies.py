import re
with open('d:/code/github/distill/cookies_www.bilibili.com.txt', 'r') as f:
    content = f.read()
fixed = re.sub(r'^(\.[^\t]+\t)FALSE', r'\1TRUE', content, flags=re.MULTILINE)
with open('d:/code/github/distill/cookies_www.bilibili.com.txt', 'w') as f:
    f.write(fixed)
print('done')
