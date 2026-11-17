pipeline {
  agent any
  environment {
    IMAGE = "atharv1923/smartrail"
    TAG   = "${env.BUILD_NUMBER}"
  }
  triggers { pollSCM('H/2 * * * *') }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install and Test') {
      steps {
        bat 'python -m pip install -r requirements.txt'
        bat 'python -m py_compile app.py'
      }
    }
    stage('Docker Build') {
      steps { bat "docker build -t %IMAGE%:%TAG% -t %IMAGE%:latest ." }
    }
    stage('Push to Docker Hub') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub',
            usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          bat 'echo %DH_PASS%| docker login -u %DH_USER% --password-stdin'
          bat "docker push %IMAGE%:%TAG%"
          bat "docker push %IMAGE%:latest"
        }
      }
    }
    stage('Deploy to Kubernetes') {
      steps {
        bat 'kubectl apply -f deployment.yaml -f service.yaml'
        bat "kubectl set image deployment/smartrail smartrail=%IMAGE%:%TAG%"
        bat 'kubectl rollout status deployment/smartrail'
      }
    }
  }
  post { always { bat 'docker logout' } }
}
