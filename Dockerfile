# 使用 Node.js 官方提供的 alpine 镜像作为基础镜像
FROM node:alpine

# 将工作目录切换到 /usr/src/app
WORKDIR /usr/src/app

# 复制项目的 package.json 和 package-lock.json 文件到容器的工作目录
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 将整个项目复制到容器的工作目录
COPY . .

# 暴露 8600 端口
EXPOSE 8600

# 定义项目启动命令
CMD ["npm", "start"]