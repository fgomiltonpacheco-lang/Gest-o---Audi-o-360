import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { fillAudiometriaTemplatePdf, type AudiometriaCoordinates } from '@/lib/pdfTemplateFiller'
import { mergeAudiometria, DEFAULT_AUDIOMETRIA } from '@/lib/pdfCoordinateUtils'
import type { AudiometryExamFull, Patient, ClinicSettings } from '@/types'

describe('pdfTemplateFiller & audiometria coordinates', () => {
  it('DEFAULT_AUDIOMETRIA contém todas as coordenadas calibradas corretas incluindo logo', () => {
    expect(DEFAULT_AUDIOMETRIA.nome).toEqual({ x: 78, y: 730 })
    expect(DEFAULT_AUDIOMETRIA.data).toEqual({ x: 468, y: 730 })
    expect(DEFAULT_AUDIOMETRIA.cpf).toEqual({ x: 72, y: 708 })
    expect(DEFAULT_AUDIOMETRIA.nascimento).toEqual({ x: 230, y: 708 })
    expect(DEFAULT_AUDIOMETRIA.sexoF).toEqual({ x: 372, y: 708 })
    expect(DEFAULT_AUDIOMETRIA.sexoM).toEqual({ x: 400, y: 708 })
    expect(DEFAULT_AUDIOMETRIA.convenio).toEqual({ x: 488, y: 708 })
    expect(DEFAULT_AUDIOMETRIA.audiometro).toEqual({ x: 108, y: 686 })
    expect(DEFAULT_AUDIOMETRIA.calibracao).toEqual({ x: 450, y: 686 })
    expect(DEFAULT_AUDIOMETRIA.graficoOD).toEqual({ left: 52, top: 642, width: 220, height: 148 })
    expect(DEFAULT_AUDIOMETRIA.graficoOE).toEqual({ left: 326, top: 642, width: 220, height: 148 })
    expect(DEFAULT_AUDIOMETRIA.mtOD).toEqual({ x: 80, y: 460 })
    expect(DEFAULT_AUDIOMETRIA.lrfOD).toEqual({ x: 154, y: 460 })
    expect(DEFAULT_AUDIOMETRIA.ldvOD).toEqual({ x: 232, y: 460 })
    expect(DEFAULT_AUDIOMETRIA.mtOE).toEqual({ x: 348, y: 460 })
    expect(DEFAULT_AUDIOMETRIA.lrfOE).toEqual({ x: 422, y: 460 })
    expect(DEFAULT_AUDIOMETRIA.ldvOE).toEqual({ x: 500, y: 460 })
    expect(DEFAULT_AUDIOMETRIA.iprfOD).toEqual({
      intensidadeX: 98,
      dissilabosX: 160,
      monossilabosX: 225,
      mascaramentoX: 258,
      y: 408,
    })
    expect(DEFAULT_AUDIOMETRIA.iprfOE).toEqual({
      intensidadeX: 98,
      dissilabosX: 160,
      monossilabosX: 225,
      mascaramentoX: 258,
      y: 392,
    })
    expect(DEFAULT_AUDIOMETRIA.parecer).toEqual({ x: 45, y: 195 })
    expect(DEFAULT_AUDIOMETRIA.assinaturaNome).toEqual({ x: 247, y: 90 })
    expect(DEFAULT_AUDIOMETRIA.assinaturaCrfa).toEqual({ x: 247, y: 76 })
    expect(DEFAULT_AUDIOMETRIA.rodape).toEqual({ x: 247, y: 32 })
    expect(DEFAULT_AUDIOMETRIA.logo).toEqual({ left: 45, top: 805, width: 120, height: 42 })
  })

  it('mergeAudiometria mescla campos customizados sobre os defaults preservando logo', () => {
    const merged = mergeAudiometria({
      nome: { x: 100, y: 700 },
    })
    expect(merged.nome).toEqual({ x: 100, y: 700 })
    expect(merged.cpf).toEqual(DEFAULT_AUDIOMETRIA.cpf)
    expect(merged.logo).toEqual(DEFAULT_AUDIOMETRIA.logo)
  })

  it('preenche PDF de teste com dados de audiometria e gera buffer válido', async () => {
    // Criar um PDF em branco de teste com pdf-lib
    const baseDoc = await PDFDocument.create()
    baseDoc.addPage([595, 842])
    const templateBytes = await baseDoc.save()

    const mockExam: AudiometryExamFull = {
      id: 'exam-123',
      patientId: 'pat-1',
      patientName: 'Maria da Silva',
      created_by: 'user-1',
      date: '2026-08-23',
      cpf: '123.456.789-00',
      dob: '1985-04-12',
      age: '41',
      sex: 'F',
      referred_by: 'Dr. João',
      hearing_rest_14h: true,
      audiometer: 'AD629 - Interacoustic',
      calibration: '2026-01-10',
      otoscopy_od: 'Normal',
      otoscopy_od_obs: '',
      otoscopy_oe: 'Normal',
      otoscopy_oe_obs: '',
      air_od: {
        '250': { db: 15, symbol: 'normal' },
        '500': { db: 15, symbol: 'normal' },
        '1000': { db: 20, symbol: 'normal' },
        '2000': { db: 20, symbol: 'normal' },
        '3000': { db: 25, symbol: 'normal' },
        '4000': { db: 25, symbol: 'normal' },
        '6000': { db: 20, symbol: 'normal' },
        '8000': { db: 20, symbol: 'normal' },
      },
      air_oe: {
        '250': { db: 15, symbol: 'normal' },
        '500': { db: 15, symbol: 'normal' },
        '1000': { db: 15, symbol: 'normal' },
        '2000': { db: 20, symbol: 'normal' },
        '3000': { db: 20, symbol: 'normal' },
        '4000': { db: 20, symbol: 'normal' },
        '6000': { db: 25, symbol: 'normal' },
        '8000': { db: 20, symbol: 'normal' },
      },
      bone_od: {
        '500': { db: 10, symbol: 'normal' },
        '1000': { db: 15, symbol: 'normal' },
        '2000': { db: 15, symbol: 'normal' },
        '3000': { db: 20, symbol: 'normal' },
        '4000': { db: 20, symbol: 'normal' },
      },
      bone_oe: {
        '500': { db: 10, symbol: 'normal' },
        '1000': { db: 10, symbol: 'normal' },
        '2000': { db: 15, symbol: 'normal' },
        '3000': { db: 15, symbol: 'normal' },
        '4000': { db: 15, symbol: 'normal' },
      },
      ldl_od: {},
      ldl_oe: {},
      mt_od: 18.33,
      mt_oe: 16.67,
      lrf_od: 20,
      lrf_oe: 20,
      ldv_od: 95,
      ldv_oe: 95,
      iprf: {
        od: { intensidade: '', monossilabos: '', dissilabos: '', mascaramento: '', palavras: '' },
        oe: { intensidade: '', monossilabos: '', dissilabos: '', mascaramento: '', palavras: '' },
      },
      iprf_od: 100,
      iprf_oe: 100,
      iprf_vocal: {
        od: {
          intensidade: '55',
          dissilabos: '100',
          monossilabos: '96',
          mascaramento: '',
          palavras_faladas: '',
          niveis: '',
        },
        oe: {
          intensidade: '55',
          dissilabos: '100',
          monossilabos: '100',
          mascaramento: '',
          palavras_faladas: '',
          niveis: '',
        },
      },
      iprf_levels_od: '',
      iprf_levels_oe: '',
      srt_od: 20,
      srt_oe: 20,
      masking_air_od: null,
      masking_air_oe: null,
      masking_bone_od: null,
      masking_bone_oe: null,
      meatoscopy_od: '',
      meatoscopy_oe: '',
      marital_status: 'Casada',
      loss_degree: 'Normal',
      loss_type: '',
      loss_configuration: 'Plana',
      report: 'Limiares auditivos dentro dos padrões de normalidade em ambas as orelhas.',
      created: '',
      updated: '',
    }

    const mockPatient: Patient = {
      id: 'pat-1',
      name: 'Maria da Silva',
      cpf: '123.456.789-00',
      birthDate: '1985-04-12',
      gender: 'Feminino',
      phone: '11999999999',
      mobile: '11999999999',
      email: 'maria@example.com',
      cep: '01001-000',
      street: 'Rua A',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      planType: 'Convênio',
      planName: 'Unimed',
      hearingLossType: 'Normal',
      previousHearingAid: false,
      status: 'Ativo',
      createdAt: '',
    }

    const mockClinic: ClinicSettings = {
      id: 'ol2egon1y3uaga5',
      nome: 'Audição360',
      endereco: 'Rua Herculano Coelho de Souza, 1047 - Reunidas, Caçador - SC, CEP: 89504-590',
      telefone: '63991353398',
      email: 'audicao360@gmail.com',
      especialista_nome: 'Milton Soares Pacheco',
      especialista_crfa: '3-11981-5',
      audiometro: 'AD629 - Interacoustic',
      calibracao: '10/01/2026',
    }

    // Criar um PNG 1x1 pixel válido para testar logoBytes
    // PNG header 8 bytes: 89 50 4E 47 0D 0A 1A 0A + IHDR + IDAT + IEND
    const png1x1 = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])

    const filledBytes = await fillAudiometriaTemplatePdf(templateBytes, {
      exam: mockExam,
      patient: mockPatient,
      clinicSettings: mockClinic,
      professional: { name: 'Milton Soares Pacheco', crmCrfa: '3-11981-5' },
      logoBytes: png1x1,
    })

    expect(filledBytes).toBeInstanceOf(Uint8Array)
    expect(filledBytes.length).toBeGreaterThan(0)

    // Verifica se o PDF resultante pode ser lido pelo pdf-lib
    const parsedPdf = await PDFDocument.load(filledBytes)
    expect(parsedPdf.getPageCount()).toBe(1)
  })
})
